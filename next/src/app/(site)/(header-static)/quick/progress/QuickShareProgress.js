"use client"

import BIcon from "@/components/BIcon"
import Progress from "@/components/elements/Progress"
import Spinner from "@/components/elements/Spinner"
import { ApplicationContext } from "@/context/ApplicationContext"
import { FileContext } from "@/context/FileProvider"
import streamSaver from "@/lib/client/StreamSaver"
import { tryCopyToClipboard } from "@/lib/utils"
import { Transition } from "@headlessui/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useContext, useEffect, useMemo, useState } from "react"
import QRCode from "react-qr-code"

import { call, fileTransferGetFileList, fileTransferServeFiles, listen } from "@/lib/client/quickshare"
import * as WebRtc from "@/lib/client/webrtc"
import * as zip from "@zip.js/zip.js"
import { useQuickShare } from "@/hooks/client/useQuickShare"
import { DashboardContext } from "@/context/DashboardContext"
import { IS_SELFHOST } from "@/lib/isSelfHosted"
import SignUpModal from "@/components/SignUpModal"

const TRANSFER_STATE_WAIT_FOR_USER = "wait_for_user"
const TRANSFER_STATE_IDLE = "idle"
const TRANSFER_STATE_CONNECTING = "connecting"
const TRANSFER_STATE_TRANSFERRING = "transferring"
const TRANSFER_STATE_FINISHED = "finished"
const TRANSFER_STATE_FAILED = "failed"

export default function QuickShareProgress({ isLoggedIn }) {

  const router = useRouter()

  const { files } = useContext(FileContext)
  const { displayNotification } = useContext(DashboardContext)
  const { hasBeenSentLink, k, remoteSessionId, transferDirection } = useQuickShare()

  const [showSignUpModal, setShowSignUpModal] = useState(false)

  const [transferState, _setTransferState] = useState(hasBeenSentLink ? TRANSFER_STATE_IDLE : TRANSFER_STATE_WAIT_FOR_USER)
  const setTransferState = (ts) => {
    console.log("[QuickShareProgress] setTransferState", ts)
    _setTransferState(ts)
  }

  const [startProgressExecuted, setStartProgressExecuted] = useState(false)

  const [filesProgress, setFilesProgress] = useState(null)
  const [quickShareLink, setQuickShareLink] = useState(null)

  const [errorMessage, setErrorMessage] = useState(null)

  const hasConnected = useMemo(() => transferState == TRANSFER_STATE_TRANSFERRING || transferState == TRANSFER_STATE_FINISHED, [transferState])

  const [totalBytes, setTotalBytes] = useState(0)
  const bytesTransferred = useMemo(() => {
    if (filesProgress) {
      // console.log(filesProgress)
      return filesProgress.reduce((total, fileProgress) => total + fileProgress.bytesTransferred, 0);
    }
    return 0;
  }, [filesProgress]);
  const percentTransferred = useMemo(() => Math.floor(totalBytes / bytesTransferred * 100), [totalBytes, bytesTransferred])

  const startProgress = () => {
    setStartProgressExecuted(true)

    setTransferState(TRANSFER_STATE_IDLE)
    let filesDone = 0

    const recvDirection = (fileTransfer, fileList) => {
      setTransferState(TRANSFER_STATE_TRANSFERRING)
      const doZip = fileList.length > 1
      console.log("[QuickShareProgress] [recvDirection] File list query has been received", fileList, "doZip:", doZip)
      const fileStream = streamSaver.createWriteStream(doZip ? "transfer.zip" : fileList[0].name, {
        size: doZip ? undefined : fileList[0].size
      })

      setTotalBytes(fileList.reduce((total, file) => total + file.size, 0))

      let _filesProgress = fileList.map(file => {
        return { file: file, progress: 0, bytesTransferred: 0 }
      })
      setFilesProgress(_filesProgress.map(x => x))
      fileTransfer.requestFile(0)

      fileTransfer.onprogress = ({ now, max, done }, fileInfo) => {
        if (filesDone >= fileList.length) return console.warn("[QuickShareProgress] fileTransfer.onprogress called after files are done")
        _filesProgress[filesDone].progress = now / max
        _filesProgress[filesDone].bytesTransferred = now
        // console.log(now / max)
        setFilesProgress(_filesProgress.map(x => x))
      }

      if (doZip) {
        const zipStream = new zip.ZipWriterStream({ level: 0, zip64: true, bufferedWrite: false })

        let _filesProgress = fileList.map(file => {
          return { file: file, progress: 0 }
        })
        setFilesProgress(_filesProgress.map(x => x))

        // zipStream.readable.pipeTo(fileStream)
        // console.log(fileList[0].name)
        let currentZipWriter = zipStream.writable(fileList[0].relativePath).getWriter()

        zipStream.readable.pipeTo(fileStream)

        fileTransfer.onfiledata = (data, fileInfo) => {
          currentZipWriter.write(data)
        }

        fileTransfer.onfilefinished = (fileInfo) => {
          currentZipWriter.close()
          filesDone++

          if (filesDone >= fileList.length) {
            zipStream.close().then(() => setTransferState(TRANSFER_STATE_FINISHED))
            return
          }

          currentZipWriter = zipStream.writable(fileList[filesDone].relativePath).getWriter()

          if (filesDone >= fileList.length) {
            console.error("THIS SHOULD NOT HAPPEN: Requesting more files even when all files are downloaded!?")
          }
          else {
            fileTransfer.requestFile(filesDone)
          }
        }
      }
      else {
        // const fileWriter = fileStream.getWriter();

        // Create a TransformStream to handle chunking the data
        const chunkSize = 524288; // 524,288 bytes
        const transformer = new TransformStream({
          start(controller) {
            this.chunk = new Uint8Array(chunkSize);
            this.offset = 0;
          },
          transform(data, controller) {
            let dataOffset = 0;
            while (dataOffset < data.length) {
              let remainingSpaceInChunk = chunkSize - this.offset;
              let bytesToWrite = Math.min(remainingSpaceInChunk, data.length - dataOffset);

              this.chunk.set(data.slice(dataOffset, dataOffset + bytesToWrite), this.offset);
              this.offset += bytesToWrite;
              dataOffset += bytesToWrite;

              if (this.offset === chunkSize) {
                controller.enqueue(this.chunk);
                this.chunk = new Uint8Array(chunkSize);
                this.offset = 0;
              }
            }
          },
          flush(controller) {
            if (this.offset > 0) {
              controller.enqueue(this.chunk.slice(0, this.offset));
            }
          }
        });

        const chunkStream = transformer.readable;
        const writer = transformer.writable.getWriter();

        // Connect the chunk stream to the file writer
        chunkStream.pipeTo(fileStream);

        fileTransfer.onfiledata = (data, fileInfo) => {
          writer.write(data).catch(err => {
            console.error("Error writing chunk:", err);
            setTransferState(TRANSFER_STATE_FAILED);
          });
        };

        fileTransfer.onfilefinished = (fileInfo) => {
          writer.close().then(() => {
            filesDone++;
            setTransferState(TRANSFER_STATE_FINISHED);
          }).catch(err => {
            console.error("Error closing writer:", err);
            setTransferState(TRANSFER_STATE_FAILED);
          });
        };
      }
    }

    let waitTimer = null

    const sendDirection = (fileTransfer) => {
      setTotalBytes(files.reduce((total, file) => total + file.size, 0))
      let _filesProgress = files.map(file => {
        return { file: file, progress: 0, bytesTransferred: 0 }
      })
      setFilesProgress(_filesProgress.map(x => x))
      fileTransfer.onfilebegin = fileInfo => {
        waitTimer && clearTimeout(waitTimer)
        setTransferState(TRANSFER_STATE_TRANSFERRING)
      }
      fileTransfer.onprogress = ({ now, max }, fileInfo) => {
        _filesProgress[filesDone].progress = now / max
        _filesProgress[filesDone].bytesTransferred = now
        setFilesProgress(_filesProgress.map(x => x))
      }
      fileTransfer.onfilefinished = fileInfo => {
        filesDone++
        if (filesDone >= files.length) {
          setTransferState(TRANSFER_STATE_FINISHED)
        }
      }
    }

    const onerror = err => {
      console.error(err)
      setTransferState(TRANSFER_STATE_FAILED)
      if (err instanceof WebRtc.PeerConnectionError) {
        // setShowPeerConnectionError(true)
        // setErrorMessage("Peer connection failed.")
        console.error("Peer connection failed.")
      }
      else {
        setErrorMessage(err.message || "Sorry an unknown error has occured! Check back later and we should hopefully have fixed it.")
      }
    }

    if (hasBeenSentLink) {
      setTransferState(TRANSFER_STATE_CONNECTING)
      // User has been sent a link, assuming upload on behalf or receive files

      call(remoteSessionId, k, totalBytes > 10_000_000).then(fileTransfer => {
        if (transferDirection == "R")
          fileTransferGetFileList(fileTransfer).then(fileList => recvDirection(fileTransfer, fileList))
        else
          fileTransferServeFiles(fileTransfer, files).then(() => sendDirection(fileTransfer))
      }).catch(onerror)
    }
    else {
      const directionCharForRecipient = transferDirection == "R" ? "S" : "R"

      const oncandidate = (candidate) => {
        waitTimer && clearTimeout(waitTimer)
        waitTimer = setTimeout(() => {
          if (transferState == TRANSFER_STATE_WAIT_FOR_USER || transferState == TRANSFER_STATE_CONNECTING) {
            // setTransferState(TRANSFER_STATE_IDLE)
          }
        }, 15000)
        setTransferState(TRANSFER_STATE_CONNECTING)
      }

      listen(
        linkWithoutDirection => setQuickShareLink(linkWithoutDirection + directionCharForRecipient),
        candidate => oncandidate(candidate)
      ).then(fileTransfer => {
        if (transferDirection == "S")
          fileTransferServeFiles(fileTransfer, files).then(() => sendDirection(fileTransfer))
        else
          fileTransferGetFileList(fileTransfer).then(fileList => recvDirection(fileTransfer, fileList))
      }).catch(onerror)
    }
  }

  useEffect(() => {
    console.log("BEFORE", hasBeenSentLink, k, remoteSessionId, transferDirection)
    if (startProgressExecuted) return
    // transferDirection is undefined means it hasnt been checked yet

    if (transferDirection === undefined) {
      return
    }
    if (transferDirection === null) {
      return router.replace("/quick")
    }

    console.log("AFTER",hasBeenSentLink, k, remoteSessionId, transferDirection)

    // Setup WebRtc websocket connection, and close it when leaving page.
    // startProgress is run before websocket connects, but webrtc.js code handles the waiting for us
    // so nothing to worry about here

    WebRtc.createWebSocket()
    startProgress()
    return () => {
      WebRtc.closeWebSocket()
    }
  }, [transferDirection])

  const sendTitle = "Quick Transfer"
  const recvTitle = "Receive Files"
  const title = hasBeenSentLink ? (transferDirection == "R" ? recvTitle : sendTitle) : (transferDirection == "S" ? sendTitle : recvTitle)

  const spinner = <Spinner className={"inline-block"} sizeClassName={"h-4 w-4"} />

  const handleCopy = async e => {
    if (await tryCopyToClipboard(quickShareLink)) {
      displayNotification("success", "Copied Link", "The Quick Transfer link was successfully copied to the clipboard!")
    }
  }

  return (
    <>
      <SignUpModal show={showSignUpModal} onShowChange={setShowSignUpModal} />
      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full max-w-64">
          <h1 className="text-3xl font-bold mb-4 block md:hidden">{title}</h1>
          <div className="relative">
            <QRCode style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              className={"bg-white p-5 border rounded-lg shadow-sm"}
              size={128}
              fgColor="#212529"
              value={quickShareLink ? quickShareLink : "https://transfer.zip/?542388234752394243924377293849asdasd"} />
            <Transition show={hasConnected || hasBeenSentLink}>
              <div className="absolute bg-gray-50 left-0 top-0 w-full max-w-full h-full rounded-lg p-16 border transition data-[closed]:opacity-0">
                <Progress autoFinish now={bytesTransferred} max={totalBytes} unit={"%"} />
              </div>
            </Transition>
          </div>
          {!hasBeenSentLink && (
            <div>
              <div className="relative mt-2 flex items-center">
                <input
                  type="url"
                  className="block w-full rounded-md border-0 py-1.5 pr-20 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                  defaultValue={quickShareLink}
                  contentEditable="false"
                />
                <div className="absolute inset-y-0 right-0 flex py-1.5 pr-1.5">
                  <button onClick={handleCopy} className="inline-flex items-center rounded border border-gray-200 px-1 pe-1.5 font-sans text-xs text-primary font-medium bg-white hover:bg-gray-50">
                    <BIcon name={"copy"} className={"mr-1 ms-1"} />Copy
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-1 hidden md:block">{title}</h1>
          {!errorMessage ?
            (<ol className="list-decimal list-inside mb-4 md:mb-2">
              {/* <li>Choose if you want to send or receive files.</li> */}
              <li className={transferState == TRANSFER_STATE_IDLE ? "" : "text-gray-400"}>{(hasBeenSentLink && !IS_SELFHOST) ? "Connecting to server..." : "Scan the QR code or send the link to the recipient."} {transferState == TRANSFER_STATE_IDLE && spinner}</li>
              <li className={transferState == TRANSFER_STATE_CONNECTING ? "" : "text-gray-400"}>Wait for your devices to establish a connection. {transferState == TRANSFER_STATE_CONNECTING && spinner}</li>
              <li className={transferState == TRANSFER_STATE_TRANSFERRING ? "" : "text-gray-400"}>Stand by while the files are being transfered. {transferState == TRANSFER_STATE_TRANSFERRING && spinner}</li>
              <li className={transferState == TRANSFER_STATE_FINISHED ? "" : "text-gray-400"}>Done!</li>
            </ol>)
            :
            <p className="text-danger"><b className="text-danger">Error: </b>{errorMessage}</p>
          }
          {!IS_SELFHOST && transferState != TRANSFER_STATE_FINISHED && (
            <Link
              href={"/app/new"}
              onNavigate={e => {
                if (!isLoggedIn) {
                  e.preventDefault()
                  if (window.sa_loaded) window.sa_event("quick-share_upsell_clicked")
                  setShowSignUpModal(true)
                }
              }}
              className="text-start flex md:inline-flex gap-2 border rounded-lg shadow-sm py-2 ps-3 pe-4 bg-primary-50 group">
              <div className="flex items-center h-6">
                <BIcon center className={"text-primary-500 text-sm animate-pulse group-hover:animate-none mt-1"} name={"lightning-fill"} />{" "}
              </div>
              <div>
                <p className="sm:text-lg font-semibold text-primary-500">
                  {hasBeenSentLink ? "Keep your browser window open" : "Link expires when tab is closed."}
                </p>
                {!hasBeenSentLink &&
                  <span className="text-primary-500">
                    Make the link available {isLoggedIn ? <span className="">for longer</span> : <span className="font-medium">up to a year</span>}
                    {" "}
                    <span className="relative transition-all left-0 group-hover:left-1">&rarr;</span>
                  </span>
                }
              </div>
            </Link>
          )}
        </div>
      </div>
    </>
  )
}