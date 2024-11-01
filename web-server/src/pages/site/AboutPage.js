import promo_1 from "../../img/promo_1.png"
import promo_2 from "../../img/promo_2.png"
import landing_bg from "../../img/landing_background.png"
import { useEffect, useState } from "react"
import MaxWidthContainer from "../../components/MaxWidthContainer"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { Helmet } from "react-helmet"
import UploadFilesArea from "../../components/app/UploadFilesArea"

export default function AboutPage({ }) {

    let willRedirectToQuickShare = false
    let hashList = null
    if (window.location.hash) {
        hashList = window.location.hash.slice(1).split(",")
        willRedirectToQuickShare = hashList.length === 3
    }

    const navigate = useNavigate()
    const [stars, setStars] = useState(null)

    useEffect(() => {
        if (willRedirectToQuickShare) return
        fetch("https://api.github.com/repos/robinkarlberg/transfer.zip-web", {
            "credentials": "omit",
            "method": "GET"
        }).then(res => res.json()).then(json => {
            setStars(json.stargazers_count)
        }).catch(err => {
            console.log("Likes fetch error :(")
        })
    }, [])

    const [files, setFiles] = useState([])

    const onReceiveClicked = e => {
        navigate("/app/quick-share/progress", {
            state: {
                transferDirection: "R"
            }
        })
    }

    const onFilesChange = (files) => {
        setFiles(files)
    }

    const onUploadFilesModalDone = async (files) => {
        navigate("/app/quick-share/progress", {
            state: {
                files,
                transferDirection: "S"
            }
        })
    }

    if (willRedirectToQuickShare) {
        const [key_b, recipientId, directionChar] = hashList

        if (recipientId.length !== 36 && (directionChar !== "R" && directionChar !== "S")) {
            throw "The URL parameters are malformed. Did you copy the URL correctly?"
        }

        const state = {
            k: key_b,
            remoteSessionId: recipientId,
            transferDirection: directionChar
        }

        window.location.hash = ""
        let newLocation = directionChar == "R" ? "/app/quick-share/progress" : "/app/quick-share"
        return <Navigate to={newLocation} state={state} replace={true} />
    }

    return (
        <div>
            <Helmet>
                <title>Transfer.zip - Send large files with no signup, no size limit, for free</title>
                {/* <meta name="description" content="Quickly send large files! No signup, no size limit, with end-to-end encryption, all for free."/> */}
            </Helmet>
            <div className="Landing-div d-flex" style={
                {
                    minHeight: "max(70vh, 700px)",
                    backgroundImage: "url(" + landing_bg + ")",
                    backgroundPosition: "center",
                    backgroundSize: "cover"
                }}>
                <div className="flex-grow-1 d-flex flex-row flex-wrap flex-md-nowrap justify-content-center align-items-start p-2 px-3 px-sm-5 m-auto gap-5" style={{ maxWidth: "1300px" }}>
                    <div className="d-flex flex-column justfiy-content-start align-items-start flex-wrap" style={{ minWidth: "300px", maxWidth: "700px" }}>
                        <h1 className="display-5 fw-bold mb-2">The <span className="text-primary">universal</span> file transfer solution.</h1>
                        <p className="text-body-secondary fs-5 d-flex flex-column mb-3">
                            <div><i className="bi bi-caret-right-fill fs-6"></i> <b>Unlimited file size with Quick Share</b></div>
                            <div><i className="bi bi-caret-right-fill fs-6"></i> End-to-end encryption</div>
                            <div><i className="bi bi-caret-right-fill fs-6"></i> No account required</div>
                        </p>
                        <div className="ms-1">
                            <a className="btn btn-primary me-2" href="/app">Open app</a>
                            <a className="btn btn-sm btn-link" target="_blank" href="https://github.com/robinkarlberg/transfer.zip-web">
                                <i className="bi bi-star"></i> Star on GitHub {stars && `(${stars})`}
                            </a>
                        </div>
                    </div>
                    <div className="bg-body-tertiary shadow-lg rounded-4">
                        <div className="d-flex flex-column flex-wrap gap-3 justify-content-center mt-2 p-md-4">
                            <div style={{ maxWidth: "400px" }}>
                                <UploadFilesArea allowFolders={true} onFilesChange={onFilesChange} className="bg-body rounded-4" style={{ minWidth: "300px" }} />
                            </div>
                            <div>
                                <div className="d-flex flex-row flex-wrap gap-3" style={{ minWidth: "283px" }}>
                                    {
                                        files.length ?
                                            <button className="btn bg-primary flex-grow-1 d-flex justify-content-center align-items-center py-1 px-5 rounded-4"
                                                onClick={() => onUploadFilesModalDone(files)}>
                                                <div style={{ width: "40px", height: "40px" }}
                                                    className="rounded-circle bg-primary-dark d-flex justify-content-center align-items-center">
                                                    <i className="bi bi-arrow-up-short text-light fs-2"></i>
                                                </div> <small className="text-light">Send</small>
                                            </button>
                                            :
                                            <button className="btn w-100 bg-body flex-grow-0 d-flex justify-content-center align-items-center py-1 px-4 rounded-4"
                                                onClick={() => onReceiveClicked()}>
                                                <div style={{ width: "40px", height: "40px" }}
                                                    className="rounded-circle d-flex justify-content-center align-items-center">
                                                    <i className="bi bi-arrow-down-short text-body fs-2"></i>
                                                </div> <small>Receive files instead</small>
                                            </button>
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-body text-body px-3 px-sm-5" data-bs-theme="dark">
                <div className="m-auto" style={{ maxWidth: "1500px" }}>
                    <div className="pt-4 pb-0 d-flex justify-content-center rounded-pill">
                        <h4 className="text-center"><i className="bi bi-trophy me-2"></i>Trusted by 8000+ users every month!</h4>
                    </div>
                    <ul className="d-flex flex-row flex-wrap justify-content-center list-unstyled mb-0 pt-4 pb-4 gap-4">
                        <li style={{ maxWidth: "400px" }} className="text-body-secondary">
                            <div className="fs-6">
                                <i className="bi bi-quote me-1"></i>
                                <span>F*****g THANK you. Everyone else has recommended site that all have limits on file size that are just too small for me ... </span>
                            </div>
                            <a className="text-body-tertiary" href="https://www.reddit.com/r/techsupport/comments/bjqmm6/comment/lj01kxe/">-Bravo-Xray</a>
                        </li>
                        <li style={{ maxWidth: "400px" }}>
                            <div className="fs-5">
                                <i className="bi bi-quote me-1"></i>
                                <span>Love how simple and no-BS Transfer.zip is.</span>
                            </div>
                            <a className="text-body" href="https://www.reddit.com/r/techsupport/comments/bjqmm6/comment/kilzfob/">-maddogmdd</a>
                        </li>
                        <li style={{ maxWidth: "400px" }} className="text-body-secondary">
                            <div className="fs-6">
                                <i className="bi bi-quote me-1"></i>
                                <span>
                                    ... after spending hours browsing for a simple way to send a 23 GB file, this is the answer.
                                </span>
                            </div>
                            <a className="text-body-tertiary" href="https://www.reddit.com/r/techsupport/comments/bjqmm6/comment/lgjz9lh/">-amca12006</a>
                        </li>
                    </ul>
                </div>
            </div>
            <div id="about" className="clip overflow-hidden px-3 px-sm-5 bg-secondary-subtle" data-bs-theme="dark" style={{ clipPath: "margin-box" }}>
                <div className="m-auto" style={{ maxWidth: "1200px" }}>
                    <div className="d-flex flex-column flex-md-row-reverse pt-5" style={{ height: "400px" }}>
                        <div style={{ maxWidth: "31.2vw" }} className="flex-shrink-1 d-none d-md-inline-block">
                            <img src={promo_1} className="rounded-4" style={{ position: "relative", left: "5vw", maxWidth: "700px" }}></img>
                        </div>
                        <div style={{ minWidth: "260px" }}>
                            <h1 className="h2 fw-bold text-body">Share your <span className="text-primary">{ /*most important*/}big</span> files while keeping them secure.</h1>
                            <p className="text-body-secondary mb-2">
                                Wether you want to send a 4K movie, share a screenshot or collaborate on creative projects,
                                your files are stored encrypted for no one to see except you and your peers.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-body clip overflow-hidden px-3 px-sm-5" style={{ clipPath: "margin-box" }}>
                <div className="m-auto" style={{ maxWidth: "1200px" }}>
                    <div className="d-flex flex-row pt-5" style={{ height: "400px" }}>
                        <div className="d-none d-md-inline-block" style={{ width: "calc(60vw - 31.2vw)" }}>
                            <img src={promo_2} className="rounded-4" width="700px" style={{ position: "relative", left: "calc(31.2vw - 780px)" }}></img>
                        </div>
                        <div style={{ minWidth: "260px" }}>
                            <h2 className="fw-bold">Unlimited file size with <span className="text-primary">Quick Share</span>.</h2>
                            {/* <h5>- For when you need to send something really big. </h5> */}
                            <p className="text-body-secondary">
                                Send files in realtime, with no file size limit. The files are end-to-end encrypted, and will be transfered directly
                                between you and the recipient, using peer-to-peer technology.
                                Quick Share is completely private and <a href="https://github.com/robinkarlberg/transfer.zip-web/">open source.</a>
                            </p>
                            <a className="btn btn-primary" href={process.env.REACT_APP_APP_URL + "/app"}>Try now, no account required</a>
                        </div>
                    </div>
                </div>
            </div>
            <MaxWidthContainer maxWidth={"1100px"} className="bg-body-secondary py-5 px-3">
                <div>
                    <div className="m-auto mt-5">
                        <h2 className="display-5 fw-bold">The <span className="">fastest</span> - and <span className="text-primary">cheapest</span> way.</h2>
                        <p className="fs-5 mb-5">
                            By using peer-to-peer connections, we eliminate the need for a server, which greatly improves transfer speeds.
                            This also helps keep the cost of the service down to the minimum, by not using a server when possible.
                        </p>
                        <h3 className="h2">So, Transfer Smarter!</h3>
                        <p className="fs-5">
                            Ideal for professionals and hobbyists alike. Whenever you need to share files, use Transfer.zip!
                        </p>
                    </div>
                </div>
                <div className="d-flex flex-row flex-wrap py-4 gap-3">
                    <div className="flex-grow-1 bg-body text-center p-3 py-5 rounded">
                        <h2 className="fw-bold"><i className="bi bi-ban me-2"></i>No file size limit</h2>
                        <p style={{ maxWidth: "300px" }} className="m-auto">When the file is transfered using Quick Share, there are no file size or bandwidth limitations.</p>
                    </div>
                    <div className="flex-grow-1 bg-body text-center p-3 py-5 rounded">
                        <h2 className="fw-bold"><i className="bi bi-file-earmark-lock2 me-2"></i>Encryption</h2>
                        <p style={{ maxWidth: "300px" }} className="m-auto">Transfers are encrypted using AES-256. <nobr>Quick Share</nobr> is end-to-end encrypted using a client-side generated key.</p>
                    </div>
                    <div className="flex-grow-1 bg-body text-center p-3 py-5 rounded">
                        <h2 className="fw-bold"><i className="bi bi-bar-chart-fill me-2"></i>Statistics</h2>
                        <p style={{ maxWidth: "300px" }} className="m-auto">See comprehensive download statistics for all your transfers, enabling you to make better decisions.</p>
                    </div>
                    <div className="flex-grow-1 bg-body text-center p-3 py-5 rounded">
                        <h2 className="fw-bold"><i className="bi bi-piggy-bank-fill me-2"></i>Fair price</h2>
                        <p style={{ maxWidth: "300px" }} className="m-auto">Our <Link to="pricing">plans</Link> are some of the most competitive in the business.</p>
                    </div>
                    <div className="flex-grow-1 bg-body text-center p-3 py-5 rounded">
                        <h2 className="fw-bold"><i className="bi bi-cpu-fill me-2"></i>Self-Hostable</h2>
                        <p style={{ maxWidth: "300px" }} className="m-auto">For ultimate trust, Transfer.zip is easy to <a href="https://github.com/robinkarlberg/transfer.zip-web/tree/main?tab=readme-ov-file#self-hosting">setup locally to self-host.</a></p>
                    </div>
                    <div className="flex-grow-1 bg-body text-center p-3 py-5 rounded">
                        <h2 className="fw-bold"><i className="bi bi-github me-2"></i>Open source</h2>
                        <p style={{ maxWidth: "300px" }} className="m-auto">The file transfer source code is freely available on GitHub. <a href="https://github.com/robinkarlberg/transfer.zip-web/">Check it out.</a></p>
                    </div>
                </div>
            </MaxWidthContainer>
            <MaxWidthContainer maxWidth={500} className={"my-5"}>
                <div className="text-center">
                    <h2 className="display-6 fw-bold">Try it today!</h2>
                    <p>No account or credit card required.</p>
                    <a className="btn btn-primary py-2 px-3" href={"/app"}>Open app</a>
                </div>
            </MaxWidthContainer>
        </div>
    )
}