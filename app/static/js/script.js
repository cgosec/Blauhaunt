let cy = cytoscape();
let loading = document.getElementById('loading');
loading.classList.add('loaded');

let ds = document.getElementById("darkSwitch");
let fromDate = document.getElementById("from-date")
let toDate = document.getElementById("to-date")
let min_size = 30
let max_size = 45
let default_size = 37
const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const sidRegex = /^S-\d-\d+(-\d+)+$/


let edgesCounter = document.getElementById("edgesCounter") // element to display the number of edges
let nodesCounter = document.getElementById("nodesConter") // element to display the number of nodes
let renderGraphBtn = document.getElementById("currentDisplayBtn") // button to render the graph


let current_nodes = new Set() // holds all the nodes of the case depending on the graph style
let current_edges = new Set() // holds all the edges of the case depending on the graph style
let filtered_nodes = new Set(); // holds all the nodes that are will be rendered
let filtered_edges = new Set(); // holds all the edges that are will be rendered
let graphStyle = document.getElementsByClassName("graphStyle")

let loading_bar = document.getElementById('loading');
let caseData  // holds all the Case Information
let searchOpen = false  // indicates if the search history modal is open

let logonTypes = new Set()  // this is just to hold the logon types for the 4624 and 4625 events so they are not created multiple times
let tagColorMap = new Map()  // holds the color for each tag


let userStatistics = {}  // used for the stats
let systemStatisics = {}  // used for the stats

let localIPs = ["LOCAL", "127.0.0.1", "::1"]  // for filtering in Event processing
let bad_hostnames = ["-"]  // for filtering in Event processing
let objects = []  // here all the single objects will be in from the processed lines of the event file
let rank = true // rank is a needed indication for the custom sorting algorithm for the nodes
let hostMapDelimiter = ","  // this is the delimiter for the hostMap file

let ctrlPressed = false  // this is used to check if the ctrl key is pressed
let altPressed = false  // this is used to check if the alt key is pressed

let timeOffsetList = document.getElementById("timeOffsetList")


/*
prepare the UI
* */
ds.addEventListener("change", darkmode)
darkmode()
getCases()
generateBlankCaseData()

for (const btn of graphStyle) {
    // the graph style buttons are used to switch between the different ways to display the graph.
    btn.addEventListener("click", e => {
        let mode = e.target.id
        console.debug(`Graph Style switched to ${mode}`)
        switch (mode) {
            case "modeUser":
                // user --event--> system
                prepareUserNodesAndEdges(caseData.userEdges).then(data => {
                    current_nodes = data.nodes
                    current_edges = data.edges
                    //setNodesAndEdges(current_nodes, current_edges)
                    createQuery()
                })
                break
            default :
                // system --user(event)--> system

                prepareHostNodesAndEdges(caseData.hostEdges).then(data => {
                    current_nodes = data.nodes
                    current_edges = data.edges
                    //setNodesAndEdges(current_nodes, current_edges)
                    createQuery()
                })
        }
    })
}

// allow users to select the timezone they want to display the graph. Lists will stay in UTC.
timeOffsetList.addEventListener("change", e => {
    // this is used to set the time offset for the case. this is needed to display the correct time in the graph
    let offset = e.target.value
    if (offset === "none") {
        caseData.timezoneSelection = 14
    } else {
        caseData.timezoneSelection = e.target.selectedIndex
    }
});


function applyTimeOffset(time) {
    // this is used to apply the time offset to a given time
    return time + ((timeOffsetList.value || 0) * 60 * 60 * 1000)
}

let offsetMap = new Map()
offsetMap.set("none", "Z")
offsetMap.set("-12", "Y")
offsetMap.set("-11", "X")
offsetMap.set("-10", "W")
offsetMap.set("-9", "V")
offsetMap.set("-9.5", " V†")
offsetMap.set("-8", "U")
offsetMap.set("-7", "T")
offsetMap.set("-6", "S")
offsetMap.set("-5", "R")
offsetMap.set("-4", "Q")
offsetMap.set("-3.5", "P†")
offsetMap.set("-3", "P")
offsetMap.set("-2", "O")
offsetMap.set("-1", "N")
offsetMap.set("0", "Z")
offsetMap.set("1", "A")
offsetMap.set("2", "B")
offsetMap.set("3", "C")
offsetMap.set("3.5", "C†")
offsetMap.set("4", "D")
offsetMap.set("4.5", "D†")
offsetMap.set("5", "E")
offsetMap.set("5.5", "E†")
offsetMap.set("6", "F")
offsetMap.set("6.5", "F†")
offsetMap.set("7", "G")
offsetMap.set("8", "H")
offsetMap.set("8.75", "H*")
offsetMap.set("9", "I")
offsetMap.set("9.5", "I†")
offsetMap.set("10", "K")
offsetMap.set("10.5", "K†")
offsetMap.set("11", "L")
offsetMap.set("12", "M")
offsetMap.set("12.75", "M*")
offsetMap.set("13", "M†")

function applyTimeOffsetToTimeString(isoString) {
    const date = new Date(isoString);
    const offset = (timeOffsetList.value || 0.0)
    const rest = offset % 1
    const hours = offset > 0 ? Math.floor(offset) : Math.ceil(offset)
    const minutes = Math.floor(rest * 60)
    date.setHours(date.getHours() + hours)
    date.setMinutes(date.getMinutes() + minutes)
    let dateString = date.toISOString()
    dateString = dateString.replace(".000Z", offsetMap.get(offset))
    return dateString
}


// Attach the event listener to the page to trigger defined short cuts
document.addEventListener("keypress", e => {
    if (e.ctrlKey && e.key === "\x11" && !searchOpen) {
        console.debug("history")
        userSearchHistory()
        e.preventDefault(); // Prevent the default browser refresh

    } else if (e.ctrlKey && e.key === "\x02" && !searchOpen) {
        dstHostSearchHistory()
        e.preventDefault(); // Prevent the default browser refresh

    } else if (e.ctrlKey && e.key === "\x19" && !searchOpen) {
        srcHostSearchHistory()
        e.preventDefault(); // Prevent the default browser refresh
    }
    // store caseData to IndexDB with Ctrl + M
    else if (e.ctrlKey && e.code === "KeyM") {
        console.debug("saving case")
        e.preventDefault(); // Prevent the default browser refresh
        let caseName = document.getElementById("newCaseName").value
        // if no case name is give the user will be prompted to enter a case name
        while (!caseName) {
            caseName = prompt("Please enter a case name")
            if (caseName === null) return
            document.getElementById("newCaseName").value = caseName
        }
        storeDataToIndexDB(caseName)
        document.getElementById('case_list').innerHTML = ''
        getCases()
    }
});

document.addEventListener("keydown", e => {
    if (e.ctrlKey)
        ctrlPressed = true
    if (e.altKey)
        altPressed = true
    altPressed = true
})

document.addEventListener("keyup", e => {
    if (!e.ctrlKey)
        ctrlPressed = false
    if (!e.altKey)
        altPressed = false
})

function darkmode() {
    if (ds.checked) {
        ncolor_sys = "#ff0000"
        nbcolor_sys = "#ffc0cb"
        nfcolor_sys = "#ff69b4"
        ncolor_user = "#0000cd"
        nbcolor_user = "#cee1ff"
        nfcolor_user = "#6da0f2"
        ncolor_chenge = "#404040"
        nfcolor_root = "#404040"
        ncolor_host = "#2e8b57"
        nbcolor_host = "#006c00"
        nfcolor_host = "#3cb371"
        ncolor_domain = "#8b2e86"
        nbcolor_domain = "#fa98ef"
        nfcolor_domain = "#b23aa2"
        ncolor_id = "#8b6f2e"
        nbcolor_id = "#f9d897"
        nfcolor_id = "#b28539"
        edge_color = "#CCCCCC"
        ecolor = "#9bb0d9"
    } else {
        ncolor_sys = "#FF5917"
        nbcolor_sys = "#000000"
        nfcolor_sys = "#FF5917"
        ncolor_user = "#5D86FF"
        nbcolor_user = "#000000"
        nfcolor_user = "#5D86FF"
        ncolor_chenge = "#B59658"
        nfcolor_root = "#ADADAD"
        ncolor_host = "#44D37E"
        nbcolor_host = "#000000"
        nfcolor_host = "#44D37E"
        ncolor_domain = "#9573FF"
        nbcolor_domain = "#000000"
        nfcolor_domain = "#9573FF"
        ncolor_id = "#F9D46B"
        nbcolor_id = "#000000"
        nfcolor_id = "#F9D46B"
        edge_color = "#C1C1C1"
        ecolor = "#5252ee"
        timelinebg = "#FFFFFF"
    }
}

function generateBlankCaseData() {
    caseData = {
        hostEdges: new Set(),
        userEdges: new Set(),
        nodesName: new Set(),
        edgesName: new Set(),
        nodeTranslation: new Map(),
        userEdgesLogonTimes: new Map(),
        hostEdgesLogonTimes: new Map(),
        userNodeNames: new Set(),
        ip2hostMapper: {},
        ip2hostMapperFromFile: {},
        host2ipMapper: {},
        host2ipMapperFromFile: {},
        userSidMapper: {},
        sidUserMapper: {},
        hostInfo: new Map(),
        nodeMap: new Map(),
        tags: new Set(),
        eventIDs: new Set(),
        rankData: {
            maxLogonsUser: 0,
            medianLogonUser: 0,
            q1LogonUser: 0,
            q3LogonUser: 0,
            maxSourceIPCount: 0,
            maxTargetComputerCount: 0,
            medianTargetComupterCount: 0,
            q1TargetComupterCount: 0,
            q3TargetComupterCount: 0,
            logonUserCount: {},
            sourceIPCount: {},
            targetComputerCount: {},
            logonUserTimes: {},
            systemTimes: {},
            latestTime: 0,
            earliestTime: 9999999999999
        },
        userSearchHistory: [],
        srcHostSearchHistory: [],
        dstHostSearchHistory: [],
        permanentHighlightedEdges: new Set(),
        timezoneSelection: 14
    }
}

function resetScene() {
    // reset scene is called when a new case is loaded. simply add cleanOnLoad class to an element that needs to be cleaned
    const toCleanList = document.getElementsByClassName("cleanOnLoad")
    filtered_nodes = []
    filtered_edges = []
    for (const element of toCleanList) {
        element.innerHTML = ""
    }
}

// Function to store data in IndexedDB. this is where all the data is stored for the case to be able to load it later again
function storeDataToIndexDB(caseName) {
    // Open the IndexedDB database
    const request = indexedDB.open("BlauHaunt", 1);

    request.onerror = function (event) {
        console.error('Error opening database:', event.target.error);
    };

    request.onupgradeneeded = function (event) {
        const db = event.target.result;
        // Create an object store (table) in the database
        const objectStore = db.createObjectStore("BlauHauntCases");
    };

    request.onsuccess = function (event) {
        const db = event.target.result;
        const transaction = db.transaction("BlauHauntCases", 'readwrite');
        const objectStore = transaction.objectStore("BlauHauntCases");
        // Store the data object with the given case name
        objectStore.put(caseData, caseName);
        transaction.oncomplete = function () {
            console.debug('Data stored in IndexedDB successfully.');
        };
        transaction.onerror = function (event) {
            console.error('Error storing data:', event.target.error);
        };
    };
}

// function to load stored case data from indexedDB
function getCases() {
    const request = indexedDB.open('BlauHaunt', 1);

    request.onupgradeneeded = function (event) {
        const db = event.target.result;
        // Create an object store (table) in the database
        const objectStore = db.createObjectStore("BlauHauntCases");
        console.debug("BlauHaunt IndexDB created or updated")
    };
    request.onerror = function (event) {
        console.error('Error opening database:', event.target.error);
    };
    request.onsuccess = function (event) {
        const db = event.target.result;

        const transaction = db.transaction('BlauHauntCases', 'readonly');
        const objectStore = transaction.objectStore('BlauHauntCases');

        const oStoreRequest = objectStore.getAllKeys();
        oStoreRequest.onerror = function (event) {
            console.error('Error opening database:', event.target.error);
        };
        oStoreRequest.onsuccess = function (event) {
            // create all the elements, butons, filters etc.
            let caseDropDown = document.getElementById("case_list") || document.createElement("div")  // this is needed for the backend edition
            const keys = event.target.result;
            for (let caseName of keys) {
                let wrapper1 = document.createElement("div")
                let wrapper2 = document.createElement("div")
                wrapper1.classList.add("dropdown-item")
                wrapper2.classList.add("row")
                let col1 = document.createElement("div")
                col1.classList.add("col-8")
                let txt = document.createElement("p")
                txt.innerText = caseName
                txt.classList.add("text-center")
                txt.classList.add("fs-5")
                wrapper2.appendChild(txt)

                let loadBtn = document.createElement("button")
                loadBtn.classList.add("btn")
                loadBtn.classList.add("btn-success")
                loadBtn.innerText = "Load"
                loadBtn.addEventListener("click", e => {
                    e.preventDefault()
                    retrieveDataFromIndexDB(caseName)
                })
                let delBtn = document.createElement("button")
                delBtn.classList.add("btn")
                delBtn.classList.add("btn-danger")
                delBtn.innerText = "Delete"
                delBtn.addEventListener("click", e => {
                    e.preventDefault()
                    deleteCasefromIdexDB(caseName)
                    document.getElementById('case_list').innerHTML = ''
                    getCases()
                })
                wrapper1.appendChild(wrapper2)
                wrapper1.appendChild(col1)
                col1.appendChild(loadBtn)
                col1.appendChild(delBtn)
                caseDropDown.appendChild(wrapper1)

            }
        };
    }
}

function deleteCasefromIdexDB(caseName) {
    const request = indexedDB.open('BlauHaunt', 1);

    request.onsuccess = function (event) {
        const db = event.target.result;
        const transaction = db.transaction('BlauHauntCases', 'readwrite');
        const objectStore = transaction.objectStore('BlauHauntCases');

        const deleteRequest = objectStore.delete(caseName);

        deleteRequest.onsuccess = function () {
            console.debug('Entry deleted successfully.');
        };

        deleteRequest.onerror = function (event) {
            console.error('Error deleting entry:', event.target.error);
        };

        transaction.oncomplete = function () {
            console.debug('Transaction completed.');
        };

        transaction.onerror = function (event) {
            console.error('Transaction error:', event.target.error);
        };
    };

    request.onerror = function (event) {
        console.error('Error opening database:', event.target.error);
    };
}

// list cases: const transaction = db.transaction(db.objectStoreNames);
// Function to retrieve data from IndexedDB this is called in getCases()
function retrieveDataFromIndexDB(caseName, callback) {
    const request = indexedDB.open('BlauHaunt', 1);
    resetScene()

    request.onerror = function (event) {
        console.error('Error opening database:', event.target.error);
    };

    request.onsuccess = function (event) {
        const db = event.target.result;
        const transaction = db.transaction("BlauHauntCases", 'readonly');
        const objectStore = transaction.objectStore("BlauHauntCases");
        const getRequest = objectStore.get(caseName);

        getRequest.onsuccess = function (event) {
            caseData = event.target.result
            if (!caseData) {
                console.error("No data found for case " + caseName)
                console.debug("Generating blank case data")
                generateBlankCaseData()
                return
            }
            console.debug(`${caseName} data loaded from IndexDB:`)
            console.debug(caseData)
            try {
                let eventSetNew = new Set()
                let tagSetNew = new Set()
                caseData.eventIDs.forEach(id => {
                    if (!eventSetNew.has(id)) {
                        caseData.eventIDs.delete(id)
                        createEventIDBtn(id)
                    }
                    eventSetNew.add(id)
                })
                console.debug("Tags:")
                console.debug(caseData.tags)
                caseData.tags.forEach(tag => {
                    if (!tagSetNew.has(tag)) {
                        caseData.tags.delete(tag)
                        createTagBtn(tag)
                    }
                    tagSetNew.add(tag)
                })
                timeOffsetList.selectedIndex = caseData.timezoneSelection
                processEdgesToNodes()
                let caseNameElement = document.getElementById("newCaseName")
                if (caseNameElement)
                    caseNameElement.value = caseName
            } catch (e) {
                console.error(e)
                generateBlankCaseData()
            }
            try {
                if (callback)
                    callback()
            } catch (e) {
                console.debug("some case Data could not be loaded... the error message was caught and is only for display")
                console.error(e)
            }
        }

        getRequest.onerror = function (event) {
            console.error('Error retrieving data:', event.target.error);
            generateBlankCaseData()
        }
    }
}

// #####################################################################################################################
// #####################################################################################################################
// ###########################################HISTORIES #######################################################
//function builds the modal with the user search history
function userSearchHistory() {
    // Check if Ctrl key and R key are pressed simultaneously
    searchOpen = true
    event.preventDefault(); // Prevent the default browser refresh
    let list = document.getElementById("searchHistoryList")
    list.innerHTML = ""
    for (const entry of caseData.userSearchHistory) {
        let hr = document.createElement("hr")
        let le = document.createElement("a")
        le.classList.add("btn-primary")
        le.innerText = entry
        le.addEventListener("click", e => {
            document.getElementById("queryUser").value = entry
            createQuery(entry)
            historyModal.hide()
        })
        list.appendChild(hr)
        list.appendChild(le)
    }
    let historyModal
    setTimeout(f => {
        historyModal = new bootstrap.Modal(document.getElementById('searchHistory'), {
            keyboard: false
        })
        document.getElementById('searchHistory').addEventListener('hidden.bs.modal', (e) => {
            searchOpen = false
        });

        historyModal.show()
    }, 50)
}

function srcHostSearchHistory() {
    searchOpen = true
    let list = document.getElementById("searchHistoryList")
    list.innerHTML = ""
    for (const entry of caseData.srcHostSearchHistory) {
        let hr = document.createElement("hr")
        let le = document.createElement("a")
        le.classList.add("btn-primary")
        le.innerText = entry
        le.addEventListener("click", e => {
            document.getElementById("queryHostSrc").value = entry
            createQuery()
            historyModal.hide()
        })
        list.appendChild(hr)
        list.appendChild(le)
    }
    let historyModal
    setTimeout(f => {
        historyModal = new bootstrap.Modal(document.getElementById('searchHistory'), {
            keyboard: false
        })
        document.getElementById('searchHistory').addEventListener('hidden.bs.modal', (e) => {
            searchOpen = false
        });

        historyModal.show()
    }, 50)
}

function dstHostSearchHistory() {
    searchOpen = true
    let list = document.getElementById("searchHistoryList")
    list.innerHTML = ""
    for (const entry of caseData.dstHostSearchHistory) {
        let hr = document.createElement("hr")
        let le = document.createElement("a")
        le.classList.add("btn-primary")
        le.innerText = entry
        le.addEventListener("click", e => {
            document.getElementById("queryHostDst").value = entry
            createQuery()
            historyModal.hide()
        })
        list.appendChild(hr)
        list.appendChild(le)
    }
    let historyModal
    setTimeout(f => {
        historyModal = new bootstrap.Modal(document.getElementById('searchHistory'), {
            keyboard: false
        })
        document.getElementById('searchHistory').addEventListener('hidden.bs.modal', (e) => {
            searchOpen = false
        });
        historyModal.show()
    }, 50)
}

function setNodesAndEdges(nodes, edges) {
    // this function is called when the graph style is changed or the graph is filtered.
    // it sets the nodes and edges to be rendered and displays the number of nodes and edges in the UI
    filtered_edges = [...edges]
    filtered_nodes = [...nodes]
    nodesCounter.innerText = nodes.length || nodes.size || 0
    edgesCounter.innerText = edges.length || edges.size || 0
    renderGraphBtn.disabled = (filtered_nodes.size === 0 || filtered_edges.size === 0)
}


function renderGraphBtnClick(currentDisplay) {
    for (const e of document.getElementsByClassName("dynamic-display")) {
        e.classList.add("d-none")
    }
    if (!currentDisplay) {
        currentDisplay = "graph"
        for (const btn of document.getElementsByClassName("render-radios")) {
            if (btn.checked) {
                currentDisplay = btn.value
            }
        }
    }
    console.debug("Rendering. Current display is set to " + currentDisplay)
    switch (currentDisplay) {
        case "graph":
            //check if there are more than 500 nodes raise a modeal with a warning
            if (filtered_nodes.length > 500 || filtered_edges.length > 1500) {
                let modal = new bootstrap.Modal(document.getElementById('graphWarning'), {
                    keyboard: false
                })
                modal.show()
                break
            } else {
                drawGraph({nodes: filtered_nodes, edges: filtered_edges}, "")
                document.getElementById("innerStage").classList.remove("d-none")
                document.getElementById("timespan").classList.remove("d-none")
                break
            }
            break
        case "timeline":
            table = createTimelineSystemView(filtered_edges)
            timeline.innerHTML = ""
            timeline.appendChild(table)
            timeline.style.zIndex = "2"
            document.getElementById("timeline").classList.remove("d-none")
            break
        case "heatmap":
            createHeatmap()
            document.getElementById("heatmap").classList.remove("d-none")
            break
    }
}

function createEventIDBtn(eventID, description) {
    // this function creates the buttons dynamically to filter for eventIDs
    if (caseData.eventIDs.has(eventID)) return
    caseData.eventIDs.add(eventID)
    for (const btnGrp of document.getElementsByClassName("eventBtnGroup")) {
        // we have to check each button group if the id is already in
        for (const btn of btnGrp.children) {
            if (btn.innerText === ('' + eventID)) {
                console.debug("Event ID already in btnGroup")
                return
            }
        }
    }
    let eventBtnGroups = document.getElementsByClassName("eventBtnGroup")
    let currentBtnGroupForEventBtns;
    try {
        currentBtnGroupForEventBtns = eventBtnGroups[eventBtnGroups.length - 1]
    } catch (e) {
        currentBtnGroupForEventBtns = false
    }
    if (!currentBtnGroupForEventBtns || currentBtnGroupForEventBtns.children.length >= 4) {
        currentBtnGroupForEventBtns = document.createElement("div")
        currentBtnGroupForEventBtns.role = "group"
        currentBtnGroupForEventBtns.classList.add("btn-group")
        currentBtnGroupForEventBtns.classList.add("cleanOnLoad")
        currentBtnGroupForEventBtns.classList.add("eventBtnGroup")
        document.EventIDs.appendChild(currentBtnGroupForEventBtns)
    }

    let newEventBtn = document.createElement("label")
    newEventBtn.setAttribute("data-bs-toggle", "tooltip")
    newEventBtn.setAttribute("data-bs-placement", "top")
    newEventBtn.title = description
    let newEventBtnInput = document.createElement("input")
    newEventBtnInput.type = "checkbox"
    newEventBtnInput.id = "evtBtn" + eventID
    newEventBtnInput.value = eventID
    newEventBtnInput.classList.add("btn-check")
    newEventBtnInput.classList.add("eventIdBtns")
    newEventBtnInput.checked = true
    let newEventBtnInnerLabel = document.createElement("label")
    newEventBtnInnerLabel.classList.add("btn")
    newEventBtnInnerLabel.classList.add("btn-outline-secondary")
    newEventBtnInnerLabel.htmlFor = "evtBtn" + eventID
    newEventBtnInnerLabel.innerText = eventID
    newEventBtn.appendChild(newEventBtnInput)
    newEventBtn.appendChild(newEventBtnInnerLabel)

    currentBtnGroupForEventBtns.appendChild(newEventBtn)
    eventID = "" + eventID
    if (eventID === "4624" || eventID === "4625") {
        createLogonTypeBtn(2)
        createLogonTypeBtn(3)
        createLogonTypeBtn(4)
        createLogonTypeBtn(5)
        createLogonTypeBtn(7)
        createLogonTypeBtn(8)
        createLogonTypeBtn(9)
        createLogonTypeBtn(10)
        createLogonTypeBtn(11)
        document.LogonTypes.style.display = "block"
    }
}

function createLogonTypeBtn(logonType) {
    // create filter buttions for logon types (only has effect on 4624 and 4625 events)
    if (logonTypes.has(logonType)) return
    logonTypes.add(logonType)

    let logonTypeBtn = document.createElement("label")
    logonTypeBtn.setAttribute("data-bs-toggle", "tooltip")
    logonTypeBtn.setAttribute("data-bs-placement", "top")
    logonTypeBtn.title = `LogonType ${logonType}`
    let logonTypeBtnInput = document.createElement("input")
    logonTypeBtnInput.type = "checkbox"
    logonTypeBtnInput.id = "logonType" + logonType + "Btn"
    logonTypeBtnInput.classList.add("btn-check")
    logonTypeBtnInput.classList.add("logonTypeBtns")
    logonTypeBtnInput.value = logonType
    logonTypeBtnInput.checked = true
    let logonTypeBtnInnerLabel = document.createElement("label")
    logonTypeBtnInnerLabel.classList.add("btn")
    logonTypeBtnInnerLabel.classList.add("btn-outline-secondary")
    logonTypeBtnInnerLabel.htmlFor = "logonType" + logonType + "Btn"
    logonTypeBtnInnerLabel.innerText = logonType
    logonTypeBtn.appendChild(logonTypeBtnInput)
    logonTypeBtn.appendChild(logonTypeBtnInnerLabel)
    document.LogonTypes.appendChild(logonTypeBtn)

}

function createTagColorPicker(tag) {
    // TagColorPickers will be applied to the nodes of the graph. the color of the node will be set to the color of the tag
    // colors for tags will be saved in the localstroage on the system so they are accessible not only for the present case
    let item = document.createElement("div")
    item.classList.add("dropdown-item")
    let pickerWrapper = document.createElement("div")
    pickerWrapper.classList.add("row")
    let a = document.createElement("div")
    a.classList.add("col-6")
    a.innerText = tag
    let b = document.createElement("div")
    b.classList.add("col-4")
    let b1 = document.createElement("div")
    b1.classList.add("row")
    let cPickerBorder = document.createElement("input")
    cPickerBorder.type = "color"
    cPickerBorder.id = `${tag}+"Color"`
    cPickerBorder.value = localStorage.getItem(tag + "Color") || nfcolor_host
    cPickerBorder.addEventListener("change", e => {
        tagColorMap.get(tag).color = e.target.value
        tagColorMap.get(tag).default = false
        localStorage.setItem(tag + "Color", e.target.value)
    })

    let priority = document.createElement("input")
    priority.classList.add("form-control")
    priority.type = "number"
    priority.min = 1
    priority.value = localStorage.getItem(tag + "ColorPrio") || 1
    priority.addEventListener("change", e => {
        tagColorMap.get(tag).priority = e.target.value
        localStorage.setItem(tag + "ColorPrio", e.target.value)
    })

    item.appendChild(pickerWrapper)
    pickerWrapper.appendChild(a)
    pickerWrapper.appendChild(b)
    b.appendChild(b1)
    b1.appendChild(cPickerBorder)
    b1.appendChild(priority)
    document.getElementById("tagColorList").appendChild(pickerWrapper)
    tagColorMap.set(tag, {
        color: localStorage.getItem(tag + "Color") || nfcolor_host,
        default: !localStorage.getItem(tag + "Color"),
        priority: localStorage.getItem(tag + "ColorPrio") || 1
    })
}


function createTagBtn(tag) {
    tag = '' + tag
    tag = tag.trim()
    // create filter buttons for tags
    if (caseData.tags.has(tag) || ipRegex.test(tag)) return // if the tag is an IP address it will not be displayed as a tag
    caseData.tags.add(tag)
    createTagColorPicker(tag)
    let tagBtnGroup = document.getElementsByClassName("tagBtnGroup")
    let currentBtnGrouForTagsBtns;
    try {
        currentBtnGrouForTagsBtns = tagBtnGroup[tagBtnGroup.length - 1]
    } catch (e) {
        currentBtnGrouForTagsBtns = false
    }
    if (!currentBtnGrouForTagsBtns || currentBtnGrouForTagsBtns.children.length >= 2) {
        currentBtnGrouForTagsBtns = document.createElement("div")
        currentBtnGrouForTagsBtns.role = "group"
        currentBtnGrouForTagsBtns.classList.add("btn-group")
        currentBtnGrouForTagsBtns.classList.add("tagBtnGroup")
        document.getElementById("tagFilterRow").appendChild(currentBtnGrouForTagsBtns)
    }
    let newEventBtn = `<label data-bs-toggle="tooltip" data-bs-placement="top" title="${tag}">
                        <input type="checkbox" id=${"tagBtn" + tag.replace(" ", "-")} value="${tag}" class="btn-check tagBtns">
                        <label class="btn btn-outline-secondary" for=${"tagBtn" + tag.replace(" ", "-")}>${tag}</label>
                    </label>`
    let evtBtnLabel = document.createElement("label")
    evtBtnLabel.setAttribute("data-bs-toggle", "tooltip")
    evtBtnLabel.setAttribute("data-bs-placement", "top")
    evtBtnLabel.title = tag
    let evtBtnInput = document.createElement("input")
    evtBtnInput.type = "checkbox"
    evtBtnInput.id = "tagBtn" + tag.replace(" ", "-")
    evtBtnInput.value = tag
    evtBtnInput.classList.add("btn-check")
    evtBtnInput.classList.add("tagBtns")
    let evtBtnInnerLabel = document.createElement("label")
    evtBtnInnerLabel.classList.add("btn")
    evtBtnInnerLabel.classList.add("btn-outline-secondary")
    evtBtnInnerLabel.htmlFor = "tagBtn" + tag.replace(" ", "-")
    evtBtnInnerLabel.innerText = tag
    evtBtnLabel.appendChild(evtBtnInput)
    evtBtnLabel.appendChild(evtBtnInnerLabel)
    currentBtnGrouForTagsBtns.appendChild(evtBtnLabel)
}


/*
Here the filtering begins..
 */
function applyEventFilters() {
    let eventFilters = []
    let allChecked = true  // this is to aviod unnecessary processing. if everything is checked, no filter is needed
    let eventIdBtns = document.getElementsByClassName("eventIdBtns")
    for (const btn of eventIdBtns) {
        if (btn.checked)
            eventFilters.push(btn.value)
        else
            allChecked = false
    }
    if (allChecked)
        return []
    return eventFilters
}

function applyLogonTypesFilter() {
    let logonTypes = []
    let allChecked = true  // this is to aviod unnecessary processing. if everything is checked, no filter is needed
    let eventIdBtns = document.getElementsByClassName("logonTypeBtns")
    for (const btn of eventIdBtns) {
        if (btn.checked)
            logonTypes.push(parseInt(btn.value))
        else
            allChecked = false
    }
    if (allChecked) return []
    return logonTypes
}


function applyTagFilters() {
    let tagFilters = []
    //let allChecked = true  // this is to aviod unnecessary processing. if everything is checked, no filter is needed
    let eventIdBtns = document.getElementsByClassName("tagBtns")
    for (const btn of eventIdBtns) {
        if (btn.checked)
            tagFilters.push(btn.value)
    }
    return tagFilters
}

function filter(filterObject) {
    /**
     * the filterObject contains list of strings for nodes and edges. only nodes with the nlable in the list will be displayed. same for edges
     * filterObject {nodes: ["nlabel1", "nlabel2"],
     *              {node_types: ["Host", "User"]}
     *        event_ids: ["eventID"]
     *        }
     *        DOCTRIN FOR DEVELPOING: APPLY FILTERS ALWAYS OUTGOING FROM THE EDGES NOT FROM NODES - NODES SHOULD BE CREATED AS NEEDED FROM THE EDGES
     */
    filterObject.event_ids = applyEventFilters()
    filterObject.logonTypes = applyLogonTypesFilter().map(type => {
        return parseInt(type)
    })
    filterObject.tags = applyTagFilters()
    filtered_edges = [...current_edges]
    filtered_edges.map(async edge => {
        edge.data.source = (caseData.nodeTranslation.get(edge.data.source) || edge.data.source)
        edge.data.target = (caseData.nodeTranslation.get(edge.data.target) || edge.data.target)
    })

    //filter for highlighted edges only
    if (document.getElementById("highlightedEdgesOnly").checked) {
        filtered_edges = filtered_edges.filter(edge => {
                return caseData.permanentHighlightedEdges.has(edge.data.id)
            }
        )
    }

    // filter out same origin and target
    if (!document.getElementById("selfCon").checked) {
        filtered_edges = filtered_edges.filter(edge => {
            return (edge.data.target !== edge.data.source)
        })
    }
    let userModGraph = document.getElementById("modeUser").checked

    // filter for source hosts
    if (!userModGraph && filterObject.srcHosts) {
        let invertsrcHosts = document.getElementById("invertSrcHostRegex").checked
        if (invertsrcHosts) {
            filtered_edges = filtered_edges.filter(edge => {
                return !filterObject.srcHosts.test(edge.data.source)
            })
        } else {
            filtered_edges = filtered_edges.filter(edge => {
                return filterObject.srcHosts.test(edge.data.source)
            })
        }
    }

    // filter for users
    if (filterObject.users) {
        let invertUsers = document.getElementById("invertUserRegex").checked
        if (invertUsers) {
            filtered_edges = filtered_edges.filter(edge => {
                return !filterObject.users.test(edge.data.UserName)
            })
        } else {
            filtered_edges = filtered_edges.filter(event => {
                return filterObject.users.test(event.data.UserName)
            })
        }
    }

    // filter for destination hosts
    if (filterObject.dstHosts) {
        let invertDstHosts = document.getElementById("invertDstHostRegex").checked
        if (invertDstHosts) {
            filtered_edges = filtered_edges.filter(edge => {
                return !filterObject.dstHosts.test(edge.data.target)
            })
        } else {
            filtered_edges = filtered_edges.filter(edge => {
                return filterObject.dstHosts.test(edge.data.target)
            })
        }
    }

    // filter for custom distinction
    if (filterObject.customDistinction) {
        let invertCustomDistinction = document.getElementById("invertDistinctionRegex").checked
        if (invertCustomDistinction) {
            filtered_edges = filtered_edges.filter(edge => {
                return !filterObject.customDistinction.test(edge.data.Distinction)
            })
        } else {
            filtered_edges = filtered_edges.filter(edge => {
                return filterObject.customDistinction.test(edge.data.Distinction)
            })
        }
    }

    // filter for event
    if (filterObject.event_ids.length > 0) {
        filtered_edges = filtered_edges.filter(edge => {
            return filterObject.event_ids.includes("" + edge.data.EventID)
        })
    }

    //filter for logon types
    if ((filterObject.event_ids.length === 0 || filterObject.event_ids.includes("" + 4624) || filterObject.event_ids.includes("" + 4625)) && filterObject.logonTypes.length > 0) {
        filtered_edges = filtered_edges.filter(edge => {
            return (edge.data.EventID != 4624 && edge.data.EventID != 4625) || filterObject.logonTypes.includes(edge.data.LogonType)
        })
    }
    // reduce number of edges by joining them if selected
    if (false) { // document.getElementById("joinEdges").checked when ever this is implemented
        filtered_edges = joinEdges(filtered_edges)
        rank = false
    } else rank = true

    // filter for time frame
    let from = fromDate.value + "Z"
    let to = toDate.value + "Z"
    if (from || to) {
        from = new Date(from).getTime() || 0
        to = new Date(to).getTime() || 9999999999999
        // convert to UTC time (subtract the local offset to get UTC time)
        from = from + (from - applyTimeOffset(from)) //we need to invert the offset here because we want to apply the offset to the time
        to = to + (to - applyTimeOffset(to)) // same here
        filtered_edges = filtered_edges.filter(edge => {
            for (const t of edge.data.EventTimes) {
                let ts = new Date(t).getTime()
                if (from <= ts && ts <= to) {
                    return true
                }
            }
            return false
        })
        // this is needed to avoid loosing the event times in the edges in total
        filtered_edges = structuredClone(filtered_edges)
        filtered_edges.forEach(edge => {
            edge.data.EventTimes = edge.data.EventTimes.filter(t => {
                let ts = new Date(t).getTime()
                return from <= ts && ts <= to
            })
            edge.data.count = edge.data.EventTimes.length
        })
    }

    let weekendOnly = document.getElementById("filterForWeekendsCkbx").checked
    // filter only for events that occured during the weekend
    if (weekendOnly) {
        filtered_edges = filtered_edges.filter(edge => {
            for (const t of edge.data.EventTimes) {
                let ts = new Date(t)
                ts = new Date(applyTimeOffset(ts.getTime()))
                if (ts.getUTCDay() === 6 || ts.getUTCDay() === 0) {
                    return true
                }
            }
            return false
        })
        // this is needed to avoid loosing the event times in the edges in total
        filtered_edges = structuredClone(filtered_edges)
        filtered_edges.forEach(edge => {
            edge.data.EventTimes = edge.data.EventTimes.filter(t => {
                let ts = new Date(t)
                ts = new Date(applyTimeOffset(ts.getTime()))
                return ts.getUTCDay() === 6 || ts.getUTCDay() === 0
            })
            edge.data.count = edge.data.EventTimes.length
        })
    }


    // filter for time span
    let fromClock = document.getElementById("from-clock").value
    let toClock = document.getElementById("to-clock").value
    if (fromClock || toClock) {
        fromClock = fromClock ? fromClock.split(":")[0] * 60 + (fromClock.split(":")[1] * 1) : 0
        toClock = toClock ? toClock.split(":")[0] * 60 + (toClock.split(":")[1] * 1) : 1500

        filtered_edges = filtered_edges.filter(edge => {
            for (const t of edge.data.EventTimes) {
                let d = new Date(applyTimeOffset(new Date(t).getTime()))
                let tocompare = d.getUTCHours() * 60 + d.getUTCMinutes()
                if (fromClock < toClock && fromClock <= tocompare && tocompare <= toClock) {
                    return true
                }
                if (fromClock > toClock && ((fromClock <= tocompare && tocompare >= toClock) || (toClock >= tocompare && tocompare <= fromClock))) {
                    return true
                }
            }
            return false
        })
        filtered_edges = structuredClone(filtered_edges)
        filtered_edges.forEach(edge => {
            edge.data.EventTimes = edge.data.EventTimes.filter(t => {
                let d = new Date(applyTimeOffset(new Date(t).getTime()))
                let tocompare = d.getUTCHours() * 60 + d.getUTCMinutes()
                if (fromClock < toClock && fromClock <= tocompare && tocompare <= toClock) {
                    return true
                }
                if (fromClock > toClock && ((fromClock <= tocompare && tocompare >= toClock) || (toClock >= tocompare && tocompare <= fromClock))) {
                    return true
                }
                return false
            })
            edge.data.count = edge.data.EventTimes.length
        })
    }

    // filter for source hosts and destination hosts - todo actually I am not sure why I did this and if it is still needed - but it does not destroy anything so far...
    if (filterObject.srcHosts && filterObject.dstHosts && !filterObject.users) {
        filtered_edges = filtered_edges.filter(edge => {
            return (filterObject.srcHosts.test(edge.data.source) && filterObject.dstHosts.test(edge.data.target))
        })
    }

    // filter for Tags
    if (filterObject.tags && filterObject.tags.length > 0) {
        filtered_edges = filtered_edges.filter(event => {
            try {
                return ((caseData.hostInfo.get(event.data.source).tags.filter(tag => {
                    return filterObject.tags.includes(tag)
                }).length > 0) || (caseData.hostInfo.get(event.data.target).tags.filter(tag => {
                    return filterObject.tags.includes(tag)
                }).length > 0))
            } catch (error) {
                return false
            }
        })
    }

    // filter for min connections out
    let minConnectionsOut = document.getElementById("minOutgoingConnections").value
    if (minConnectionsOut) {
        let conCount = new Map()
        filtered_edges.forEach(edge => {
            conCount.set(edge.data.source, (conCount.get(edge.data.source) || 0) + 1)
        })
        filtered_edges = filtered_edges.filter(edge => {
            return conCount.get(edge.data.source) >= minConnectionsOut
        })
    }
    processFilteredEdgesToNodes()
}


function findPath(source, destination, path, result_collector, dateLaterThan = null, initial = true, depth = 0, maxIterations = 100) {
    if (initial)
        console.debug("initial call for path search")
    if (!path)
        path = []
    let current_path = []
    dateLaterThan = dateLaterThan || new Date(0)
    console.debug(`finding path from ${source} to ${destination} with date later than ${dateLaterThan}`)
    if (depth >= maxIterations) {
        console.debug("max iterations reached")
        return
    }
    filtered_edges.forEach(edge => {
        if (edge.data.source === source) {
            if (edge.data.EventTimes.filter(t => {
                return new Date(t) >= dateLaterThan
            }).length === 0) {
                console.debug("no event times later than " + dateLaterThan)
                console.debug(edge.data.EventTimes)
                return;
            }
            if (edge.data.target === destination) {
                console.debug("found path")
                path.push(edge)
                result_collector.push(...path)
            } else {
                // check if the target is already in the path to avoid loops
                if (path.filter(p => {
                    return p.data.source === edge.data.target
                }).length > 0) {
                    console.debug(edge.data.target + " is already in the path")
                    console.debug(path)
                    return
                }
                console.debug(`going deeper: ${edge.data.target}`)
                let tmp_path = [...path]
                tmp_path.push(edge)
                let datesLaterThan = edge.data.EventTimes.filter(t => {
                    return new Date(t) >= dateLaterThan
                })
                let earliestDateThatIsLaterThan = new Date(Math.min(...datesLaterThan.map(d => {
                    return new Date(d).getTime()
                })))
                console.debug("earliest date that is later than " + dateLaterThan + " is " + earliestDateThatIsLaterThan)
                console.debug(edge.data.EventTimes)
                findPath(edge.data.target, destination, tmp_path, result_collector, earliestDateThatIsLaterThan, false, depth + 1, maxIterations)
            }
        }
    })
    return [...new Set(path)] // the path is returned, of the source itself is not relevant for the search it can be ignored if a path form to is intended and not iterations back
}

function findPathBtnClick(source, destination) {
    let matches = []
    findPath(source, destination, null, matches, null, true)
    filtered_edges = [...new Set(matches)]
    processFilteredEdgesToNodes()
}

function joinEdges(edges) {
    // this function joins edges that have the same source and target, in order to reduce the number of edges
    // toDo this can not be applied with the custom ranking / sorting algorithm
    let edgeMap = new Map()
    for (let edge of edges) {
        let edgeSourceTargetsMap = edgeMap.get(edge.data.source) || new Map()
        let targetUserMap = edgeSourceTargetsMap.get(edge.data.target) || new Map()
        let userEvents = targetUserMap.get(edge.data.UserName) || new Map()
        userEvents.set("" + edge.data.EventID + "(" + edge.data.LogonType || "-" + ")", edge.data.EventTimes)
        targetUserMap.set(edge.data.UserName, userEvents)
        edgeSourceTargetsMap.set(edge.data.target, targetUserMap)
        edgeMap.set(edge.data.source, edgeSourceTargetsMap)
    }
    let ret_edges = []
    edgeMap.forEach((targetMap, source) => {
        targetMap.forEach((userMap, target) => {
            let logonTimes = []
            let eventIDs = []
            userMap.forEach((eventMap, user) => {
                eventMap.forEach((times, event) => {
                    logonTimes = logonTimes.concat(times)
                    eventIDs.push(event)
                })
            })
            let edge = {
                "data": {
                    "id": source + target + "joined",
                    "source": source,
                    "target": target,
                    "objid": source + +target + "joined",
                    "elabel": eventIDs.join("/"),
                    "label": "joinedEdge",
                    "mod": "joinedEdge",
                    "distance": 5,
                    "ewidth": 0.1,
                    "ntype": "edge",
                    "edge_color": edge_color,
                    "ecolor": ecolor,
                    "EventTimes": logonTimes,
                    "users": userMap,
                }
            }
            ret_edges.push(edge)
        })
    })
    ranked = false
    return ret_edges
}

// #####################################################################################################################
// #####################################################################################################################
// ###################################### GRAPH PREPARATION ###############################################
function calcGraphSize() {
    // this function calculates the overall width and height of the graph based on the number of nodes
    let nodeCount = parseInt(nodesCounter.innerText)
    let graphWidth = (max_size * nodeCount) / 5
    let maxScreenWidth = screen.width * 0.7
    graphWidth = graphWidth <= maxScreenWidth ? maxScreenWidth : graphWidth
    let graphHeight = (max_size * nodeCount) / 5
    graphHeight = graphHeight <= screen.height ? screen.height : graphHeight
    max_size = max_size + (nodeCount / 50)
    return {width: graphWidth, height: graphHeight}
}


function checkAndMoveObjects(oldObject, position, size, time, connections) {
    // this function is used to check if the position of a node is already occupied by another node
    // toDo sth it not quiet working as it should
    let xDirection;
    let yDirection;
    size = size * 5
    let moved = false
    while (oldObject.position.x - oldObject.data.nwidth < position.x && oldObject.position.x + oldObject.data.nwidth > position.x && oldObject.position.y - oldObject.data.nheight < position.y && oldObject.position.y + oldObject.data.nheight > position.y) {
        moved = true
        // move second object left/right based on number
        if (connections.out < oldObject.connections.out) {
            position.x = position.x - size;
        } else if (connections.out === oldObject.connections.out) {
            if (connections.in < oldObject.connections.in) position.x = position.x - size
            else if (connections.in === oldObject.connections.in && !xDirection) {
                lastMovementLeft = !lastMovementLeft
                xDirection = xDirection || ((lastMovementLeft ? size * -1 : size))
                position.x = position.x + xDirection
            } else if (connections.in > oldObject.connections.in) {
                position.x = position.x + size
            }
        } else {
            position.x = position.x + size;
        }
        if (oldObject.position.x - oldObject.data.nwidth < position.x &&
            oldObject.position.x + oldObject.data.nwidth > position.x &&
            oldObject.position.y - oldObject.data.nheight < position.y &&
            oldObject.position.y + oldObject.data.nheight > position.y)
            break

        // move second object up/down based on timestamp
        if (time < oldObject.activityStats.q2) {
            position.y = position.y - size / 2;
        } else if (time === oldObject.activityStats.q2) {
            yDirection = yDirection || ((Math.random() * 0.5 ? size * -1 : size) / 2)
            position.y = position.y + yDirection;
        } else {
            position.y = position.y + size / 2;
        }
    }
    return moved
}

let lastMovementLeft = false

function checkOccupation(positionsOccupied, position, size, time, rank) {
    // this function is used to check if the position of a node is already occupied by another node
    let allChecked = false
    while (!allChecked) {
        for (const node of positionsOccupied) {
            let moved = checkAndMoveObjects(node, position, size, time, rank)
            if (moved) {
                //todo anyhow this does not work yet. this should make sure that when a node is moved, the nodes that are already moved are checked again
            }
        }
        allChecked = true
    }
}


function createHostNode(node) {
    let nsub = "";
    let ncategory = "";
    let nshape = "rectangle"
    let nfsize = "8"
    let ncolor = ncolor_host
    let nbcolor = nbcolor_host
    let nfcolor = nfcolor_host
    let ntype = "Host"
    let new_node = {
        "data": {
            "id": node,
            "objid": node,
            "nlabel": node,
            "ncolor": ncolor,
            "nbcolor": nbcolor,
            "nfcolor": nfcolor,
            "nwidth": default_size,
            "nheight": default_size,
            "nfsize": nfsize,
            "nshape": nshape,
            "label": "Host",
            "ntype": ntype,
            "nhostname": node,
            "ips": (caseData.host2ipMapper[node] || []).join(", "),
            "nsub": nsub,
            "ncategory": ncategory,
            "nid": node,
            "Tags": (caseData.hostInfo.get(node) || {tags: []}).tags,
            "os": (caseData.hostInfo.get(node) || {os: "Unknown"}).os,
        }, "position": 0,
    }
    setNodeColor(new_node)
    restyleNode(new_node)
    return new_node
}

function createUserNode(node) {
    let nsub = "";
    let ncategory = "";
    let nfsize = "10"
    let nshape = "ellipse"
    let ntype = "User"
    let ncolor
    let nbcolor
    let nfcolor
    ncolor = ncolor_user
    nbcolor = nbcolor_user
    nfcolor = nfcolor_user
    let new_node = {
        "data": {
            "id": node,
            "objid": node,
            "nlabel": node,
            "ncolor": ncolor,
            "nbcolor": nbcolor,
            "nfcolor": nfcolor,
            "nwidth": default_size,
            "nheight": default_size,
            "nfsize": nfsize,
            "nshape": nshape,
            "label": "User",
            "ntype": ntype,
            "nhostname": node,
            "nsub": nsub,
            "ncategory": ncategory,
            "nid": node,
        }, "position": 0,
    }
    setNodeColor(new_node)
    restyleNode(new_node)
    return new_node
}

async function prepareHostNodesAndEdges(hostEdges) {
    let ret_edges = []
    let step_nodes = new Set()
    for (const edge of hostEdges) {

        let new_edge = {...edge}
        edge.data.edge_color = edge_color
        edge.data.ecolor = ecolor
        edge.data.nfcolor = "#ff9797"
        ret_edges.push(new_edge)
        step_nodes.add(edge.data.source)
        step_nodes.add(edge.data.target)
    }
    let ret_nodes = []
    for (const node of step_nodes) {
        let new_node = createHostNode(node)
        ret_nodes.push(new_node)
    }

    return {nodes: ret_nodes, edges: ret_edges}
}

async function prepareUserNodesAndEdges(userEdges) {
    let ret_edges = []
    let step_user_nodes = new Set()
    let step_host_nodes = new Set()
    for (const edge of userEdges) {

        let new_edge = {...edge}
        edge.data.edge_color = edge_color
        edge.data.ecolor = ecolor
        edge.data.nfcolor = "#ff9797"
        ret_edges.push(new_edge)
        step_user_nodes.add(edge.data.source)
        step_host_nodes.add(edge.data.target)
    }

    let ret_nodes = []

    for (const node of step_host_nodes) {
        let new_node = createHostNode(node)
        ret_nodes.push(new_node)
    }
    for (const node of step_user_nodes) {
        let new_node = createUserNode(node)
        ret_nodes.push(new_node)
    }
    return {nodes: ret_nodes, edges: ret_edges}
}

function setNodeColor(node) {
    // this function sets the color of the node based on the tags and the color of the tag. also the node stype is adapeted according to darkmode settings
    let nodeTags = node.data.Tags
    let latestPrio = 0
    if (node.data.ntype === "Host") {
        node.data.nfcolor = nfcolor_host
        node.data.ncolor = ncolor_host
        node.data.nbcolor = nbcolor_host
        for (tag of caseData.tags) {
            if (nodeTags.includes(tag)) {
                let colorVals = tagColorMap.get(tag)
                if (!parseInt(colorVals.default) && parseInt(colorVals.priority) > latestPrio) {
                    node.data.nfcolor = colorVals.color
                    latestPrio = parseInt(colorVals.priority)
                }
            }
        }
    }
    if (node.data.ntype === "User") {
        node.data.nfcolor = nfcolor_user
        node.data.ncolor = ncolor_user
        node.data.nbcolor = nbcolor_user
    }

}

if (!serverSvgPath) {
    serverSvgPath = "static/images/font-awesome/server.svg"
}
if (!desktopSvgPath) {
    desktopSvgPath = "static/images/font-awesome/desktop.svg"
}
if (!userSvgPath) {
    userSvgPath = "static/images/font-awesome/user.svg"
}

function restyleNode(node) {
    // this function sets the style and image of the node based on the node type
    switch (node.data.ntype) {
        case "Host":
            let os = node.data.os || "Unknown"
            if (os.toLowerCase().includes("server")) node.data.nimage = serverSvgPath
            else node.data.nimage = desktopSvgPath
            node.data.opacity = "0"
            node.data.nshape = "roundrectangle"
            break
        case "User":
            node.data.nimage = userSvgPath
            node.data.opacity = "0"
            break
    }
}

function prepareNodes(nodes, edges) {
    // this function prepares the nodes for the graph. it calculates all relative data for the nodes and edges and calculates their position and size
    if (rank) {
        let graphSize = calcGraphSize()
        let consIn = [] // number of connections to all the node
        let consOut = [] // number of connections from all the node - node size will be calculated based on this
        let earliestTime = 9999999999999  //needed for the y positions this will be the general first time of all the nodes
        let latestTime = 0 // needed for the y positions this will be the general last time of all nodes
        let positionsOccupied = [] // this is used to save the positions of the nodes that are already placed
        let userModGraph = document.getElementById("modeUser").checked
        let allDatesCount = {}
        userDayActivityObj = {}
        userStatistics = {}  // this is used to save the statistics for the users for the stats display
        systemStatisics = {} // this is used to save the statistics for the systems for the stats display
        // first iteration over the nodes to get the needed global data from the
        // filtered nodes and setting relevant attributes to the node diektly
        for (let node of nodes) {
            let conIn = 0
            let conOut = 0
            let systemToSet = new Set()
            let systemFromSet = new Set()
            let inUsersSet = new Set()
            let outUsersSet = new Set()
            let timeList = []
            let nodeMinTime = 9999999999999
            let nodeMaxTime = 0
            // get the Tags for the nodes and the OS
            try {
                node.data.Tags = caseData.hostInfo.get(node.data.id).tags
                node.data.os = caseData.hostInfo.get(node.data.id).os
            } catch (error) {
                node.data.Tags = []
                node.data.os = "Unknown"
            }

            // calc needed Data for x position depending on connection behaviour
            for (const edge of edges) {
                if (edge.data.target === node.data.id) {
                    conIn += edge.data.count
                    let edgeTimeList = edge.data.EventTimes.map(date => {
                        return new Date(date).getTime()
                    })
                    let edgeMinTime = Math.min(...edgeTimeList)
                    let edgeMaxTime = Math.max(...edgeTimeList)
                    nodeMinTime = nodeMinTime < edgeMinTime ? nodeMinTime : edgeMinTime
                    nodeMaxTime = nodeMaxTime > edgeMaxTime ? nodeMaxTime : edgeMaxTime
                    timeList = timeList.concat(edgeTimeList)
                    if (userModGraph) {
                        inUsersSet.add(edge.data.source) // the system was visited by this user
                    } else {
                        inUsersSet.add(edge.data.UserName) // the system was visited by this user
                        systemFromSet.add(edge.data.source) // the system was visited by this system
                    }
                }
                if (edge.data.source === node.data.id) {
                    conOut += edge.data.count
                    let edgeTimeList = edge.data.EventTimes.map(date => {
                        return new Date(date).getTime()
                    })
                    let edgeMinTime = Math.min(...edgeTimeList)
                    let edgeMaxTime = Math.max(...edgeTimeList)
                    nodeMinTime = nodeMinTime < edgeMinTime ? nodeMinTime : edgeMinTime
                    nodeMaxTime = nodeMaxTime > edgeMaxTime ? nodeMaxTime : edgeMaxTime
                    timeList = timeList.concat(edgeTimeList)
                    systemToSet.add(edge.data.target)
                    if (userModGraph) systemToSet.add(edge.data.source) // the user connected to this system
                    if (!userModGraph) {
                        let us = userStatistics[edge.data.elabel]
                        if (!us) {
                            userStatistics[edge.data.elabel] = {
                                connections: {in: 0, out: edge.data.count}, toSystems: new Set([edge.data.target])
                            }
                        } else if (us && us.connections && us.connections.out) {
                            userStatistics[edge.data.UserName].connections.out += edge.data.count
                            userStatistics[edge.data.elabel].toSystems.add(edge.data.target)
                        } else if (us && !us.connections) {
                            userStatistics[edge.data.UserName].connections = {
                                in: 0, out: edge.data.count
                            } // the user had that many connections
                            userStatistics[edge.data.elabel].toSystems.add(edge.data.target)
                        } else {
                            userStatistics[edge.data.UserName].connections.out = edge.data.count
                            userStatistics[edge.data.elabel].toSystems.add(edge.data.target)
                        }
                        outUsersSet.add(edge.data.UserName)
                    }
                }
            }
            earliestTime = earliestTime < nodeMinTime ? earliestTime : nodeMinTime
            latestTime = latestTime > nodeMaxTime ? latestTime : nodeMaxTime
            consIn.push(conIn)
            consOut.push(conOut)
            node.connections = {in: conIn, out: conOut}
            if (node.data.ntype === "User") {
                if (!userStatistics[node.data.nlabel]) userStatistics[node.data.nlabel] = {}
                userStatistics[node.data.nlabel] = {connections: node.connections}
                userStatistics[node.data.nlabel].toSystems = systemToSet
            } else {
                systemStatisics[node.data.nlabel] = {}
                systemStatisics[node.data.nlabel].toSystems = systemToSet
                systemStatisics[node.data.nlabel].fromSystems = systemFromSet
                systemStatisics[node.data.nlabel].users = {
                    in: {count: inUsersSet.size, set: inUsersSet}, out: {count: outUsersSet.size, set: outUsersSet}
                }
                systemStatisics[node.data.nlabel].connections = node.connections

            }
            // calc needed Data for y postition depending on timing
            let qs = quartiles(timeList)
            node.activityStats = {q1: qs.q1, q2: qs.q2, q3: qs.q3}

            timeList.forEach(time => {
                let day = new Date(applyTimeOffset(new Date(time).getTime())).toISOString().split("T")[0]
                let count = allDatesCount[day] || 0
                allDatesCount[day] = count + 1
            })
        }
        // set all dayDatesCount to half the value since they are counted twice (once for each direction)
        for (const day in allDatesCount) {
            allDatesCount[day] = allDatesCount[day] / 2
        }
        //calculate the data needed for graph size
        let conInStats = quartiles(consIn)
        let conOutStats = quartiles(consOut)
        let maxConIn = conInStats.q3 + (conInStats.q3 - conInStats.q2) // take the double standard deviation as max
        let maxConOut = conOutStats.q3 + (conOutStats.q3 - conOutStats.q2) // take the double standard deviation as max
        lastLeft = false
        let timeSpan = latestTime - earliestTime
        timeSpan = timeSpan !== 0 ? timeSpan : 1 // if there is only one timestamp this would lead to a divide throu 0
        // create the possition and size
        for (let node of nodes) {
            let position = {x: 0, y: 0}
            let conRank  // this is used to specify the x position of the node.
            if (node.connections.out > conOutStats.q2) { // if the node has more connections than the median, it will be placed in the center
                if (node.connections.out > conOutStats.q3) conRank = 1
                else conRank = node.connections.out / (maxConOut)  // the more connections the node has the closer to the center it will be
            } else { //if outgoing connections are below median the node will be more concentrated on the sides
                conRank = (node.connections.in) / ((maxConOut + maxConIn))
                if (conRank > 0.5) conRank = 0.5
            }
            let yRankBase = node.activityStats.q1 - earliestTime
            position.y = (yRankBase / timeSpan) * graphSize.height
            if (lastLeft) position.x = graphSize.width - ((conRank) * (graphSize.width / 2))
            else position.x = (conRank) * (graphSize.width / 2)
            lastLeft = !lastLeft
            position.y = position.y || 0 // this is last resort if possition calculation faced any issues
            position.x = position.x || 0 // this is last resort if position calculation faced any issues
            node.position = position
            let sizeRank = (node.connections.out / maxConOut)
            if (sizeRank >= 1) sizeRank = 1.2
            let size = sizeRank * max_size
            size = size > min_size ? size : min_size
            node.data.nwidth = size
            node.data.nheight = size
            checkOccupation(positionsOccupied, position, size, node.activityStats.q1, node.connections)
            positionsOccupied.push(node)
            setNodeColor(node)
        }

        setDisplayTimeSpan(allDatesCount)//new Date(earliestTime).toUTCString(), new Date(latestTime).toUTCString())
    }
    createStatisticsDisplay()
}

// #####################################################################################################################
// #####################################################################################################################
// ###################################### EDGE HIGHLIGHTING ###############################################

function highlightEdge(edge) {
    cy.getElementById(edge.data.id).style({"line-color": "red", "width": "3"})
}

function unhighlightEdge(edge) {
    if (caseData.permanentHighlightedEdges.has(edge.data.id)) return
    cy.getElementById(edge.data.id).style({"line-color": edge.data.edge_color, "width": "1"})
}

function permanentHighlightEdge(edge) {
    caseData.permanentHighlightedEdges.add(edge.data.id)
}

function removeFromPermanentHighlightEdge(edge) {
    caseData.permanentHighlightedEdges.delete(edge.data.id)
}


// #####################################################################################################################
// #####################################################################################################################
// ###################################### GRAPH TIMESPAN DISPLAY ###############################################

function setDisplayTimeSpan(timestamplist) {
    /*
    This function is used to display the timespan with an indication of the number of events per day
    on the left side of the graph
     */
    document.getElementById("timespan").innerHTML = ""
    let dayList = Object.keys(timestamplist).sort()
    let maxDayCount = Math.max(...Object.values(timestamplist))
    let firstDay = new Date(dayList[0])
    let firstDay_double = new Date(dayList[0])
    let lastDay = new Date(dayList[dayList.length - 1])
    // if the timespan is only one day we do not display the timespan
    if (dayList.length === 1) {
        console.debug("Timespan only one day - no timespan will be displayed")
        return
    }
    //if the timespan is more than 3 months we do not display the timespan
    if (lastDay.getTime() - firstDay.getTime() > 1000 * 60 * 60 * 24 * 90) {
        console.debug("Timespan too long to display")
        return
    }

    dayList = []
    while (firstDay.getTime() <= lastDay.getTime()) {
        dayList.push(firstDay.toISOString().split("T")[0])
        firstDay.setDate(firstDay.getUTCDate() + 1)
    }
    let lastDayString = lastDay.toISOString().split("T")[0]
    if (!dayList.includes(lastDayString))
        dayList.push(lastDayString)

    let firstDaySpan = document.createElement("span")
    firstDaySpan.classList.add("mt-auto")
    firstDaySpan.classList.add("pe-2")
    firstDaySpan.classList.add("border-bottom")
    firstDaySpan.innerText = "Timezone: " + offsetMap.get(timeOffsetList.value || 0) + "\n" + firstDay_double.toISOString().split("T")[0]
    firstDaySpan.style.backgroundColor = "orange"
    document.getElementById("timespan").appendChild(firstDaySpan)

    dayList.forEach(day => {
        let daySpan = document.createElement("span")
        daySpan.classList.add("mt-auto")
        daySpan.classList.add("border-bottom")
        daySpan.classList.add("flex-grow-1")
        daySpan.classList.add("rounded-5")
        daySpan.classList.add("rounded-start")
        // daySpan.innerText = day
        let dayCountPercentage = ((timestamplist[day] || 0) / maxDayCount) * 100
        daySpan.style.width = 5 + ((dayCountPercentage) / 2) + "px"
        // color light red when weekend else color it orange
        daySpan.style.backgroundColor = new Date(day).getUTCDay() === 0 || new Date(day).getUTCDay() === 6 ? "red" : "orange"

        // add mouse over to display the date and the number of events and disappears on mouse out
        daySpan.addEventListener("mouseover", (e) => {
            let oldWidth = daySpan.style.width
            let oldBackground = daySpan.style.backgroundColor
            let oldColor = daySpan.style.color
            let oldWeight = daySpan.style.fontWeight
            let oldPadding = daySpan.style.padding
            daySpan.innerText = day + " (" + (timestamplist[day] || 0) + ")"
            daySpan.style.width = "auto"
            daySpan.style.backgroundColor = "green"
            daySpan.style.color = "white"
            daySpan.style.fontWeight = "bold"
            daySpan.style.paddingRight = "15px"
            daySpan.style.paddingTop = "2px"
            filtered_edges.forEach(edge => {
                for (const time of edge.data.EventTimes) {
                    if (new Date(applyTimeOffset(new Date(time).getTime())).toISOString().split("T")[0] === day) {
                        highlightEdge(edge)
                        break
                    }
                }
            })
            // turn style back to normal on mouse out
            daySpan.addEventListener("mouseout", (e) => {
                daySpan.innerText = ""
                daySpan.style.width = oldWidth
                daySpan.style.backgroundColor = oldBackground
                daySpan.style.padding = oldPadding
                daySpan.style.color = oldColor
                filtered_edges.forEach(edge => {
                    unhighlightEdge(edge)
                })
            })
            daySpan.addEventListener("click", (e) => {
                //highlight edges permanently when clicked on and crtl is pressed
                if (ctrlPressed) {
                    filtered_edges.forEach(edge => {
                        for (const time of edge.data.EventTimes) {
                            if (new Date(applyTimeOffset(new Date(time).getTime())).toISOString().split("T")[0] === day) {
                                if (caseData.permanentHighlightedEdges.has(edge.data.id)) {
                                    removeFromPermanentHighlightEdge(edge)
                                    unhighlightEdge(edge)
                                } else {
                                    permanentHighlightEdge(edge)
                                    highlightEdge(edge)
                                }
                                break
                            }
                        }
                    })
                }
            })
        })

        document.getElementById("timespan").appendChild(daySpan)
    })
    let lastDaySpan = document.createElement("span")
    lastDaySpan.classList.add("mt-auto")
    lastDaySpan.classList.add("pe-2")
    lastDaySpan.classList.add("border-bottom")
    lastDaySpan.innerText = lastDayString
    lastDaySpan.style.backgroundColor = "orange"
    document.getElementById("timespan").appendChild(lastDaySpan)
}

function getSVG(element) {
    // this function returns the svg for the nodes to display does not work with the images yet
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    img.setAttribute('href', element._private.data.nimage);
    img.setAttribute('width', element._private.data.nwidth);
    img.setAttribute('height', element._private.data.nheight);

    svg.appendChild(img);

    return element._private.data.nimage;
}

function getSVGSize(element) {
    return "" + element._private.data.nwidth + "px"
}

// #####################################################################################################################
// #####################################################################################################################
// ###################################### TIMELINE DISPLAY ###############################################

// TIMLELINE STUFF STARTS HERE
function createTimelineSystemView(edges) {
    let timelineEntries = []
    for (const edge of edges) {
        for (const time of edge.data.EventTimes) {
            let tableRow = document.createElement("tr")
            let tableHeadTime = document.createElement("th")
            tableRow.classList.scope = "row"
            let tableDataUser = document.createElement("td")
            let tableDataSourceSystem = document.createElement("td")
            let tableDataTargetSystem = document.createElement("td")
            let tableDataEventID = document.createElement("td")
            let tableDataLogonType = document.createElement("td")
            tableRow.appendChild(tableHeadTime)
            tableRow.appendChild(tableDataUser)
            tableRow.appendChild(tableDataSourceSystem)
            tableRow.appendChild(tableDataTargetSystem)
            tableRow.appendChild(tableDataEventID)
            tableRow.appendChild(tableDataLogonType)
            tableHeadTime.innerText = time
            tableDataUser.innerText = edge.data.UserName
            tableDataSourceSystem.innerText = edge.data.source
            tableDataTargetSystem.innerText = edge.data.target
            tableDataEventID.innerText = edge.data.EventID
            tableDataLogonType.innerText = edge.data.Logontype || "-"
            timelineEntries.push(tableRow)
        }
    }
    timelineEntries.sort((a, b) => {
        return new Date(a.children[0].innerText).getTime() - new Date(b.children[0].innerText).getTime()
    })
    let table = document.createElement("table")
    table.classList.add("table")
    table.innerHTML = "<thead><tr><th scope=\"col\">Time</th><th scope=\"col\">User</th><th scope=\"col\">Source System</th><th scope=\"col\">Target System</th><th scope=\"col\">Event</th><th scope=\"col\">Logon Type</th></tr></thead>"
    let tableBody = document.createElement("tbody")
    for (const entry of timelineEntries) {
        tableBody.appendChild(entry)
    }
    table.appendChild(tableBody)
    return table
}

function tableToCSV(table) {

    let csv_data = [];
    let rows = table.querySelectorAll('tr');
    for (let row of rows) {
        let cols = row.querySelectorAll('td,th');
        let csvrow = [];
        for (let col of cols) {
            csvrow.push(col.innerText);
        }
        csv_data.push(csvrow.join(","));
    }
    csv_data = csv_data.join('\n');

    return csv_data
}


function downloadTimelineAsCSVFile(csv_data) {

    // Create CSV file object and feed our
    // csv_data into it
    CSVFile = new Blob([csv_data], {type: "text/csv"});

    // Create to temporary link to initiate
    // download process
    var temp_link = document.createElement('a');

    // Download csv file
    temp_link.download = "timeline.csv";
    var url = window.URL.createObjectURL(CSVFile);
    temp_link.href = url;

    // This link should not be displayed
    temp_link.style.display = "none";
    document.body.appendChild(temp_link);

    // Automatically click the link to trigger download
    temp_link.click();
    document.body.removeChild(temp_link);
}


// TIMELINE STUFF ENDS HERE
// #####################################################################################################################
// #####################################################################################################################
// ###################################### HEATMAP DISPLAY ###############################################

// HEATMAPSTUFF STARTS HERE

function getHeatmapData() {
    let userDayActivityObj = {} // needed for heatmap
    let userModGraph = document.getElementById("modeUser").checked
    for (const edge of filtered_edges) {
        for (const time of edge.data.EventTimes) {
            let day = new Date(applyTimeOffset(new Date(time).getTime())).toISOString().split("T")[0]
            if (userModGraph) {
                let usrObj = userDayActivityObj[edge.data.source] || {}
                let count = (usrObj[day] || 0) + 1
                usrObj[day] = count
                userDayActivityObj[edge.data.source] = usrObj
            } else {
                let usrObj = userDayActivityObj[edge.data.UserName] || {}
                let count = (usrObj[day] || 0) + 1
                usrObj[day] = count
                userDayActivityObj[edge.data.UserName] = usrObj
            }
        }
    }
    return userDayActivityObj
}

function createHeatmap() {
    let userDayObj = getHeatmapData()
    //needed format: {day: {user: count, user: count}, day: {user: count, user: count}}
    // create table
    let heatmap = document.getElementById("heatmap")
    heatmap.innerHTML = ""
    let heatmapTable = document.createElement("table")
    heatmapTable.classList.add("table")
    let tableHead = document.createElement("thead")
    let tableHeadRow = document.createElement("tr")
    let tableHeadUser = document.createElement("th")
    tableHeadUser.innerText = "Timezone: " + offsetMap.get(timeOffsetList.value || 0) + "\nUser"
    tableHeadRow.appendChild(tableHeadUser)
    let userList = Object.keys(userDayObj).sort()
    let dayList = new Set()
    for (const user of userList) {
        for (const day of Object.keys(userDayObj[user])) {
            dayList.add(day)
        }
    }
    dayList = Array.from(dayList).sort()
    let firstDay = new Date(dayList[0])
    let lastDay = new Date(dayList[dayList.length - 1])
    dayList = []
    while (firstDay <= lastDay) {
        dayList.push(firstDay.toISOString().split("T")[0])
        firstDay.setDate(firstDay.getDate() + 1)
    }
    dayList.push(lastDay.toISOString().split("T")[0])

    // calculate max activity for outlier exclusion
    let activityQuartiles = quartiles(Object.values(userDayObj).map(usrObj => {
        return Math.max(...Object.values(usrObj))
    }))
    let maxActivityOnAllDays = activityQuartiles.q3 + ((activityQuartiles.q3 - activityQuartiles.q2) * 2)
    // remove days where there is 0 activity
    dayList = dayList.filter(day => {
        let activity = 0
        userList.forEach(user => {
            activity += userDayObj[user][day] || 0
        })
        return activity > 0
    });
    // create cols for each day
    dayList.forEach(day => {
        let tableHeadDay = document.createElement("th")
        tableHeadDay.innerText = day
        tableHeadRow.appendChild(tableHeadDay)
    })
    tableHead.appendChild(tableHeadRow)
    heatmapTable.appendChild(tableHead)

    // create table body and heatmap
    let tableBody = document.createElement("tbody")


    userList.forEach(user => {
        let tableRow = document.createElement("tr")
        let tableUser = document.createElement("th")
        tableUser.innerText = user
        tableRow.appendChild(tableUser)
        dayList.forEach(day => {
            let tableData = document.createElement("td")
            let eventCount = userDayObj[user][day] || 0
            // make the cell text bolt and blue
            tableData.style.fontWeight = "bold"
            tableData.style.color = "blue"
            tableData.innerText = eventCount
            // color the cell based on the number of events
            tableData.style.backgroundColor = `rgba(128, 0, 0, ${(eventCount / maxActivityOnAllDays)})`
            // if the eventCount is bigger than 0 add an eventlisterner on click set the filtered edges to the edges of that day
            //with the specific user and render the graph
            if (eventCount > 0) {
                //add click event to display graph of that user
                tableData.addEventListener("click", (e) => {
                    let userRegex = new RegExp("^" + user + "$")
                    let oldFromDate = fromDate.value
                    let oldToDate = toDate.value
                    fromDate.value = new Date(day)
                    // set to date to the next day
                    toDate.value = new Date(new Date(day).getTime() + 86400000)
                    filter({users: userRegex})  // get events only for that user
                    renderGraphBtnClick("graph")
                    // toDo anyhow the other nodes are still in the graph
                    // reset the date to the old one
                    fromDate.value = oldFromDate
                    toDate.value = oldToDate
                    createQuery()
                })
            }

            tableRow.appendChild(tableData)
        })
        tableBody.appendChild(tableRow)
    })
    heatmapTable.appendChild(tableBody)
    heatmap.appendChild(heatmapTable)
}

// HEATMAP STUFF ENDS HERE
// #####################################################################################################################
// #####################################################################################################################
// ###################################### STATISTICS DISPLAY (right) ###################################################

function createStatisticsDisplay() {
    // system: toSystem, fromSystem, connections.in, connections.out, users.in.count, users.out.count
    // user: toSystems, connections
    let sysList = Object.entries(systemStatisics).sort((a, b) => {
        if (b[1].toSystems.size - a[1].toSystems.size !== 0) return b[1].toSystems.size - a[1].toSystems.size
        if (b[1].connections.out - a[1].connections.out !== 0) return b[1].connections.out - a[1].connections.out
        if (b[1].fromSystems.size - a[1].fromSystems.size !== 0) return b[1].fromSystems.size - a[1].fromSystems.size
        if (b[1].connections.in - a[1].connections.in !== 0) return b[1].connections.in - a[1].connections.in
    })
    let sysT = document.getElementById("sysTable")
    sysT.innerHTML = ""
    for (const [sys, e] of sysList) {
        let row = document.createElement("tr")
        let u = document.createElement("th")
        u.scope = "row"
        u.innerText = sys
        let toSys = document.createElement("td")
        toSys.textContent = `${"" + e.toSystems.size} (${"" + e.connections.out})`
        let fromSys = document.createElement("td")
        fromSys.textContent = `${"" + e.fromSystems.size} (${e.connections.in})`
        let uIn = document.createElement("td")
        uIn.textContent = `${e.users.in.count}`
        let uOut = document.createElement("td")
        uOut.textContent = `${e.users.out.count}`
        row.appendChild(u)
        row.appendChild(toSys)
        row.appendChild(fromSys)
        row.appendChild(uOut)
        row.appendChild(uIn)
        sysT.appendChild(row)
        //highlight edges to or from this node on mouse over
        row.addEventListener("mouseover", (e) => {
            filtered_edges.forEach(edge => {
                if (edge.data.source === sys || edge.data.target === sys) highlightEdge(edge)
            })
            // turn style back to normal on mouse out
            row.addEventListener("mouseout", (e) => {
                filtered_edges.forEach(edge => {
                    unhighlightEdge(edge)
                })
            })
        })
        row.addEventListener("click", (e) => {
            if (ctrlPressed) {
                filtered_edges.forEach(edge => {
                    if (edge.data.source === sys || edge.data.target === sys) {
                        if (caseData.permanentHighlightedEdges.has(edge.data.id)) {
                            removeFromPermanentHighlightEdge(edge)
                            unhighlightEdge(edge)
                        } else {
                            permanentHighlightEdge(edge)
                            highlightEdge(edge)
                        }
                    }
                })
            }
        });
    }
    let usersList = Object.entries(userStatistics).sort((a, b) => {
        if (b[1].toSystems.size - a[1].toSystems.size !== 0) return b[1].toSystems.size - a[1].toSystems.size
        return b[1].connections.out - a[1].connections.out

    })

    let usersT = document.getElementById("userTable")
    usersT.innerHTML = ""
    for (const [user, e] of usersList) {
        let row = document.createElement("tr")
        let u = document.createElement("th")
        u.scope = "row"
        u.innerText = user
        let toSys = document.createElement("td")
        toSys.textContent = `${"" + e.toSystems.size} (${"" + e.connections.out})`
        row.appendChild(u)
        row.appendChild(toSys)
        usersT.appendChild(row)
        //highlight edges to or from this node on mouse over
        row.addEventListener("mouseover", (e) => {
            filtered_edges.forEach(edge => {
                if (edge.data.UserName === user) highlightEdge(edge)
            })
            // turn style back to normal on mouse out
            row.addEventListener("mouseout", (e) => {
                filtered_edges.forEach(edge => {
                    unhighlightEdge(edge)
                })
            })
        })
        row.addEventListener("click", (e) => {
            if (ctrlPressed) {
                filtered_edges.forEach(edge => {
                    if (edge.data.UserName === user) {
                        if (caseData.permanentHighlightedEdges.has(edge.data.id)) {
                            removeFromPermanentHighlightEdge(edge)
                            unhighlightEdge(edge)
                        } else {
                            permanentHighlightEdge(edge)
                            highlightEdge(edge)
                        }
                    }
                })
            }
        });
    }
}

// #####################################################################################################################
// #####################################################################################################################
// ###################################### GRAPH Creation ###############################################################
function nodeMouseDown(node) {
    for (const edge of node.connectedEdges()) {
        let e = edge._private
        if (!(e.data.source === node.id())) continue
        let permanentHighlight = caseData.permanentHighlightedEdges.has(e.data.id)
        if (!permanentHighlight)
            highlightEdge(e)
        if (ctrlPressed) {
            if (permanentHighlight)
                removeFromPermanentHighlightEdge(e)
            else
                permanentHighlightEdge(e)
        }
    }
}

function nodeMouseUp(node) {
    for (const edge of node.connectedEdges()) {
        let e = edge._private
        if (!(e.data.source === node.id())) continue
        let permanentHighlight = caseData.permanentHighlightedEdges.has(e.data.id)
        if (!permanentHighlight) unhighlightEdge(e)
    }
}

function edgeMouseDown(edge) {
    let e = edge._private
    if (ctrlPressed) {
        if (caseData.permanentHighlightedEdges.has(e.data.id)) {
            removeFromPermanentHighlightEdge(e)
            unhighlightEdge(e)
        } else {
            permanentHighlightEdge(e)
            highlightEdge(e)
        }
    }
}


function drawGraph(graph, rootNode) {
    // this is cytoscape stuff
    let flagCalculated = document.getElementById("calculated").checked;
    let flagGrid = document.getElementById("modeGrid").checked;
    let flagCose = document.getElementById("modeCose").checked;
    let flagCircle = document.getElementById("modeCircle").checked;
    let flagTree = document.getElementById("modeTree").checked;
    let flagConcentric = document.getElementById("modeConcentric").checked;
    let options = {}
    prepareNodes(graph.nodes, graph.edges)
    if (flagCalculated) {
        options = {
            name: "preset",
            roots: rootNode,
            animate: true,
            padding: 10
        }
    }
    if (flagGrid) {
        //flagMode = rank ? "preset" : "grid";
        options = {
            name: 'grid',
            fit: true, // whether to fit the viewport to the graph
            padding: 30, // padding used on fit
            boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
            avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
            avoidOverlapPadding: 10, // extra spacing around nodes when avoidOverlap: true
            nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
            spacingFactor: undefined, // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
            condense: false, // uses all available space on false, uses minimal space on true
            rows: undefined, // force num of rows in the grid
            cols: undefined, // force num of columns in the grid
            position: function (node) {
                return {row: node.position.x, col: node.position.y}
            },
            sort: function (a, b) {
                let ret = a._private.edges.length - b._private.edges.length
                if (ret === 0)
                    ret = a._private.position.x - b._private.position.x
                console.debug(ret)
                return ret
            },
            animate: false, // whether to transition the node positions
            animationDuration: 500, // duration of animation in ms if enabled
            animationEasing: undefined, // easing of animation if enabled
            animateFilter: function (node, i) {
                return true;
            }, // a function that determines whether the node should be animated.  All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
            ready: undefined, // callback on layoutready
            stop: undefined, // callback on layoutstop
            transform: function (node, position) {
                return position;
            } // transform a given node position. Useful for changing flow direction in discrete layouts
        };
    }
    if (flagCose) {
        options = {
            name: "cose",
            roots: rootNode,
            animate: true,
            padding: 10
        }
    }
    if (flagCircle) {
        options = {
            name: "circle",
            roots: rootNode,
            animate: true,
            padding: 10
        }
    }
    if (flagTree) {
        options = {
            name: "breadthfirst",
            roots: rootNode,
            animate: true,
            padding: 10
        }
    }
    if (flagConcentric) {
        options = {
            name: "concentric",
            roots: rootNode,
            animate: true,
            padding: 10
        }
    }
    cy = cytoscape({
        container: document.getElementById("cy"),
        boxSelectionEnabled: false,
        style: cytoscape.stylesheet()
            .selector('node').css({
                "content": "data(nlabel)",
                "width": "data(nwidth)",
                "height": "data(nheight)",
                "color": "data(ncolor)",
                "font-size": 12,//"data(nfsize)",
                "background-image": (ele) => getSVG(ele),
                "background-width": (ele) => getSVGSize(ele),
                "background-height": (ele) => getSVGSize(ele),
                "background-opacity": 0.3, //"data(opacity)",
                "background-color": "data(nfcolor)",
                "border-color": "data(nbcolor)", //"border-style": "solid",
                //"border-width": 1,
                "text-valign": "bottom",
                "text-outline-width": 0.5,
                "text-outline-color": "data(nbcolor)",
                "shape": "data(nshape)"
            })
            .selector(':selected').css({
                "border-width": 4, "border-color": "data(nfcolor)" //"#404040"
            })
            .selector('edge').css({
                "content": "data(elabel)",
                "font-size": "10",
                "curve-style": "bezier",
                "target-arrow-shape": "triangle",
                "width": 1,
                "line-color": "data(edge_color)",
                "target-arrow-color": "data(edge_color)",
                "color": "data(ecolor)",
            })
            .selector('.highlighted').css({
                "background-color": "#61bffc",
                "line-color": "#61bfcc",
                "transition-property": "background-color, line-color, target-arrow-color",
                "transition-duration": "0.5s"
            }),
        elements: graph,
        layout: options,
    });
    cy.on("layoutstop", function () {
        cy.fit({padding: 20, animated: true})
        loading_bar.classList.add("loaded");
    });
    cy.nodes().forEach(function (ele) {
        try {
            ele.qtip({
                content: {
                    title: "<b>Node Details</b>",
                    text: qtipNode(ele)
                }, style: {
                    classes: "qtip-bootstrap"
                }, position: {
                    my: "top center", at: "bottom center", target: ele
                }
            });
            ele.on('mousedown', e => nodeMouseDown(ele))
            ele.on('mouseup', e => nodeMouseUp(ele))
        } catch (error) {
            console.debug("error creating qtip");
            console.error(error);
        }
    });
    cy.edges().forEach(function (ele) {
        try {
            ele.qtip({
                content: {
                    title: "<b>Details</b>",
                    text: qtipEdge(ele)
                }, style: {
                    classes: "qtip-bootstrap"
                }, position: {
                    my: "top center",
                    at: "bottom center",
                    target: ele
                }
            });
            ele.on('mousedown', e => edgeMouseDown(ele))
        } catch (error) {
            console.debug("error creating qtip");
            console.error(error);
        }
        if (caseData.permanentHighlightedEdges.has(ele._private.data.id)) {
            highlightEdge(ele._private)
        }
    });
}


/*
qtipNode
This function generate the description text for each node.
*/
function qtipNode(ndata) {
    var qtext = 'Name: ' + ndata._private.data["nlabel"];
    if (ndata._private.data["ntype"] === "User") {
        // qtext += '<br>Privilege: ' + ndata._private.data["nprivilege"];
        qtext += '<br>LogonCount: ' + ndata._private.data["LogonCount"];
        qtext += '<br>SID: ' + ndata._private.data["SID"];
    } else if (ndata._private.data["ntype"] === "Host") {
        qtext += '<br>OS: ' + ndata._private.data["os"];
        qtext += '<br>IPs: ' + ndata._private.data["ips"];
        // qtext += '<br>Outgoing connections: ' + ndata._private.data["LogonCount"];
        let tagList = "<ul class='list-group'>"
        for (t of ndata._private.data["Tags"]) {
            tagList += `<li class="list-group-item">${t}</li>`
        }
        tagList += "</ul>"
        qtext += `<br><details><summary>Tags:</summary>${tagList}</details>`
    }

    qtext += '<br><button type="button" class="btn btn-primary btn-xs" onclick="' + 'qtipNodeFilter(' + '\'' + ndata._private.data["label"] + '\', \'' + ndata._private.data["nlabel"] + '\')">filter for</button>'
    return qtext;
}

function qtipNodeFilter(type, filterStr) {
    let filterObject = {
        users: "", hosts: "", event_ids: []
    }
    if (type === "User") document.getElementById("queryUser").value = filterStr
    if (type === "Host") {
        document.getElementById("queryHostSrc").value = filterStr
    }
}

/*
qtipEdge
This function generate the description text for each edge.
*/
function qtipEdge(ndata) {
    let qtext = "";
    if (ndata._private.data["mod"] == "System") {
        qtext += "<b>User: " + ndata._private.data['UserName'] + "</b><br>"
        qtext += "Distinction: " + ndata._private.data["Distinction"] + "<br>";
        qtext += "Count: " + ndata._private.data["count"];
        qtext += "<br>Event: " + ndata._private.data["EventID"];
        qtext += "<br>Logon Type: " + (ndata._private.data["LogonType"] || "-");
        qtext += "<br>SID: " + ndata._private.data["SID"];
        //qtext += "<br>SourceIP: " + ndata._private.data["SourceIP"];
        qtext += "<br>Description: " + ndata._private.data["Description"];
        qtext += "<br>Source System: " + ndata._private.data['eventSource']
        // qtext += "<br>Time: " + ndata._private.data["FirstEventTime"];
        let times = "<ul class='list-group'>"
        for (t of ndata._private.data["EventTimes"]) {
            times += `<li class="list-group-item">${t}</li>`
        }
        times += "</ul>"
        qtext += `<br><details><summary>${ndata._private.data["EventTimes"][0]}</summary>${times}</details>`
    }
    if (ndata._private.data["mod"] == "User") {
        qtext += "<b>Source System: " + ndata._private.data['eventSource'] + "</b><br>";
        qtext += "Distinction: " + ndata._private.data["Distinction"] + "<br>";
        qtext += "Count: " + ndata._private.data["count"];
        qtext += "<br>Event: " + ndata._private.data["EventID"];
        qtext += "<br>Logon Type: " + (ndata._private.data["LogonType"] || "-");
        qtext += "<br>SID: " + (ndata._private.data["SID"] || "-");
        //qtext += "<br>SourceIP: " + ndata._private.data["SourceIP"];
        qtext += "<br>Description: " + (ndata._private.data["Description"] || "-");
        // qtext += "<br>Time: " + ndata._private.data["FirstEventTime"];
        let times = "<ul class='list-group'>"
        for (t of ndata._private.data["EventTimes"]) {
            times += `<li class="list-group-item">${t}</li>`
        }
        times += "</ul>"
        qtext += `<br><details><summary>${ndata._private.data["EventTimes"][0]}</summary>${times}</details>`
    }
    if (ndata._private.data["mod"] === "joinedEdge") {
        qtext += "<br>Description: " + (ndata._private.data["Description"] || "-");
        // qtext += "<br>Time: " + ndata._private.data["FirstEventTime"];

        let users = "<ul class='list-group'>"
        let usersMap = ndata._private.data["users"]
        usersMap.forEach((eventList, user) => {
            let eventIDs = "<ul class='list-group'>"
            eventList.forEach((timeList, events) => {
                let times = "<ul class='list-group'>"
                for (t of timeList) {
                    times += `<li class="list-group-item">${t}</li>`
                }
                times += "</ul>"
                eventIDs += `<li class="list-group-item"><details><summary>${events}</summary>${times}</details></li>`
            })
            users += `<li class="list-group-item"><details><summary>${user}</summary>${eventIDs}</details></li>`
        });
        users += "</ul>"
        qtext += `<br><details><summary>Users</summary>${users}</details>`
    }
    return qtext;
}

// #####################################################################################################################
// #####################################################################################################################
// ###################################### FILTERING ###############################################################

function createQuery() {
    // this is called when filters are applied
    filterObject = {
        users: "", srcHosts: "", dstHosts: "", event_ids: []
    }
    let setUserStr = document.getElementById("queryUser").value.toUpperCase();
    let srcSetHostStr = document.getElementById("queryHostSrc").value.toUpperCase();
    let destSetHostStr = document.getElementById("queryHostDst").value.toUpperCase();
    let distinctionStr = document.getElementById("queryDistinction").value;
    if (setUserStr) {
        caseData.userSearchHistory.push(setUserStr)
        filterObject.users = new RegExp(setUserStr, "i")
    }
    if (srcSetHostStr) {
        caseData.srcHostSearchHistory.push(srcSetHostStr)
        filterObject.srcHosts = new RegExp(srcSetHostStr, "i")

    }
    if (destSetHostStr) {
        caseData.dstHostSearchHistory.push(destSetHostStr)
        filterObject.dstHosts = new RegExp(destSetHostStr, "i")

    }
    if (distinctionStr) {
        filterObject.customDistinction = new RegExp(distinctionStr, "i")

    }
    filter(filterObject)
}

// #####################################################################################################################
// #####################################################################################################################
// ###################################### Exports ###############################################################

// EXPORT FUNCTIONS START HERE
function exportCSV() {
    downloadTimelineAsCSVFile(tableToCSV(document.getElementById("timeline")))
}

function exportJSON() {
    var jsonData = "data:application/json,";
    jsonData += encodeURIComponent(JSON.stringify(cy.json()));
    var exptag = document.getElementById('export-json');
    exptag.href = jsonData;
}

function exportCaseJSON(caseName) {
    var jsonData = "data:application/json,";
    jsonData += encodeURIComponent(JSON.stringify({caseName: caseData}));
    var exptag = document.getElementById('export-json');
    exptag.href = jsonData;
}

function exportPNG() {
    var png64 = cy.png({scale: 10});
    var exptag = document.getElementById('export-png');
    exptag.href = png64;
}

function exportJPEG() {
    var jpg64 = cy.png({scale: 10});
    var exptag = document.getElementById('export-jpeg');
    exptag.href = jpg64;
}

// DATA PROCESSING STARTS HERE

function quartiles(arr) {
    const sortedArr = arr.sort((a, b) => a - b);
    const n = sortedArr.length;
    let q1 = n % 2 === 0 ? median(sortedArr.slice(0, n / 2)) : median(sortedArr.slice(0, Math.floor(n / 2)));
    const q2 = median(sortedArr);
    let q3 = n % 2 === 0 ? median(sortedArr.slice(n / 2)) : median(sortedArr.slice(Math.floor(n / 2) + 1));

    q1 = q1 || q2 // in case there is too less data
    q3 = q3 || q2 // in case there is too less data

    return {q1, q2, q3};
}

function median(arr) {
    const sortedArr = arr.sort((a, b) => a - b);
    const n = sortedArr.length;
    const middleIndex = Math.floor(n / 2);

    if (n % 2 === 1) {
        return sortedArr[middleIndex];
    } else {
        return (sortedArr[middleIndex - 1] + sortedArr[middleIndex]) / 2;
    }
}

// #####################################################################################################################
// #####################################################################################################################
// ###################################### Mapping from IPs to Hosts ###################################################

function fillHostAndIpMaps(csv_data, ipColName, hostColName, valueSeperator, excludes) {
    let lines = csv_data.split("\n")
    let heading = lines[0].split(hostMapDelimiter)
    heading = heading.map(function (v) {
        return v.trim()
    });
    let hostColIndex = heading.indexOf(hostColName)
    let ipColIndex = heading.indexOf(ipColName)
    excludes = excludes.split(";").map(function (v) {
        v.trim()
    })
    lines.splice(0, 1)
    for (const l of lines) {
        try {
            let lineArray = l.split(hostMapDelimiter)
            let hostname = lineArray[hostColIndex] || ""
            hostname = hostname.trim().toUpperCase()
            let ips = lineArray[ipColIndex].split(valueSeperator).map(function (v) {
                return v.trim()
            }).filter(function (v) {
                if (v.match(ipRegex)) return v
            })
            if (!ips || ips.length === 0 || (!hostname || excludes.includes(hostname))) continue
            let host2ipList = caseData.host2ipMapperFromFile[hostname] || []
            caseData.host2ipMapperFromFile[hostname] = host2ipList
            for (const ip of ips) {
                if (!host2ipList.includes(ip)) host2ipList.push(ip)
                let ip2HostList = caseData.ip2hostMapperFromFile[ip] || []
                if (!ip2HostList.includes(hostname)) {
                    ip2HostList.push(hostname)
                    caseData.ip2hostMapperFromFile[ip] = ip2HostList
                }
            }
        } catch (error) {
            console.debug(error)
            console.debug(l)
        }
    }
}


function getIPsHost(ip) {
    /*
    This function returns the hostname for a given IP or shows a modal to the user to select the correct hostname if
    more than one IP Address is in the list
     */
    return new Promise(resolve => {
        if (!ip) resolve(null)
        if (!ipRegex.test(ip)) resolve(ip.split(".")[0].toUpperCase())
        let ip2HostList = caseData.ip2hostMapperFromFile[ip] || caseData.ip2hostMapper[ip] || []
        if (ip2HostList.length > 1) {
            let hDiv = document.getElementById("hostSelectionDiv")
            hDiv.innerHTML = ""
            let rGroup = document.createElement("div")
            rGroup.innerHTML = ""
            rGroup.classList.add("btn-group")
            hDiv.appendChild(rGroup)
            document.getElementById("hostConflictModalLabel").innerText = `IP ${ip} is not resolved to a unique host`
            let counter = 0
            for (const h of ip2HostList) {
                counter += 1
                if (!(counter % 3)) {
                    rGroup = document.createElement("div")
                    rGroup.classList.add("btn-group")
                    hDiv.appendChild(rGroup)
                }
                let btn = document.createElement("button")
                btn.classList.add("btn")
                btn.classList.add("btn-primary")
                btn.innerText = h
                btn.addEventListener("click", e => {
                    e.preventDefault()
                    rGroup.innerHTML = ""
                    caseData.ip2hostMapperFromFile[ip] = [h] // this is set to the FromFile dict because this is prioritized in the next selection
                    hostSelect.hide();
                    resolve(h)
                })
                rGroup.appendChild(btn)
            }
            let customHost = document.getElementById("customHost")
            customHost.value = ip
            let selectBtn = document.getElementById("selectHostBtn")
            let cancleBtn = document.getElementById("cancelBtn")
            cancleBtn.addEventListener("click", e => {
                e.preventDefault()
                hostSelect.hide();
                resolve(null)
            });
            let cancelAllBtn = document.getElementById("cancelAllBtn")
            cancelAllBtn.addEventListener("click", e => {
                e.preventDefault()
                hostSelect.hide();
                resolve(-999) // this is the signal to cancel the whole process
            });
            let customButtonSet = e => {
                hDiv.innerHTML = ""
                hostSelect.hide();
                caseData.ip2hostMapper[ip] = [customHost.value]
                resolve(customHost.value)
                e.target.removeEventListener("click", customButtonSet)
            }
            selectBtn.addEventListener("click", customButtonSet)
            let hostSelect;
            setTimeout(f => {
                hostSelect = new bootstrap.Modal(document.getElementById('IP2HostConflict'), {
                    backdrop: 'static', keyboard: false
                })
                hostSelect.show()
            }, 10)
        } else {
            resolve(ip2HostList.length > 0 ? ip2HostList[0] : ip)
        }
    })
}

function getCSVColHeaderArray(csv) {
    return csv.split("\n")[0].split(hostMapDelimiter).map(function (v) {
        return v.trim()
    })
}


function createCSVSelectionElements(filename, csvHeaderArray) {
    /*
                    <div class="row">
                    <div class="col-8">
                        <div class="input-group">
     */
    let csvFields = document.getElementById("csvFields")
    let selHost = document.createElement("select",)
    selHost.classList.add("form-select")
    selHost.id = filename + "hostNameCol"
    let selIP = document.createElement("select")
    selIP.classList.add("form-select")
    selIP.id = filename + "ipNameCol"
    let hostLabel = document.createElement("label")
    hostLabel.innerText = "Host Column in\t" + filename + ":\t"
    let ipLabel = document.createElement("label")
    ipLabel.innerText = "IP Column in\t" + filename + ":\t"
    let delimiterLabel = document.createElement("label")
    delimiterLabel.innerText = "Delimiter"
    for (const header of csvHeaderArray) {
        let child = document.createElement("option", {value: header})
        let child2 = document.createElement("option", {value: header})
        child.innerText = header
        child2.innerText = header
        selHost.appendChild(child)
        selIP.appendChild(child2)
    }
    let col = document.createElement("div")
    col.classList.add("col-8")
    col.classList.add("csvSelectionCol")
    let group = document.createElement("div")
    let group2 = document.createElement("div")
    group.classList.add("row")
    group2.classList.add("row")
    let subGroup2_1 = document.createElement("div")
    let subGroup2_2 = document.createElement("div")
    subGroup2_1.classList.add("col-9")
    subGroup2_2.classList.add("col-1")
    group2.appendChild(subGroup2_1)
    group2.appendChild(subGroup2_2)
    let valueSeperator = document.createElement("input")
    valueSeperator.type = "text"
    valueSeperator.classList.add("form-control")
    valueSeperator.placeholder = "/"
    valueSeperator.value = "/"
    valueSeperator.id = filename + "valueSeperator"
    let excludes = document.createElement("input")
    excludes.type = "text"
    excludes.classList.add("form-control")
    excludes.placeholder = "Excludes sperated by ';'"
    excludes.id = filename + "excludes"
    col.appendChild(group)
    col.appendChild(group2)
    group.appendChild(hostLabel)
    group.appendChild(selHost)
    group.appendChild(excludes)
    subGroup2_1.appendChild(ipLabel)
    subGroup2_1.appendChild(selIP)
    subGroup2_2.appendChild(delimiterLabel)
    subGroup2_2.appendChild(valueSeperator)
    csvFields.appendChild(col)
}

function loadCSVButtonClick(e) {
    let upfile = document.getElementById("hostipmap");
    let reader = new FileReader()
    let ipCol = ""
    let hostCol = ""
    let excludes = ""
    let valueSeperator = ""
    reader.addEventListener("load", event => {
        fillHostAndIpMaps(event.target.result, ipCol, hostCol, valueSeperator, excludes)
    })
    for (const file of upfile.files) {
        ipCol = document.getElementById(file.name + "ipNameCol").value
        hostCol = document.getElementById(file.name + "hostNameCol").value
        excludes = document.getElementById(file.name + "excludes").value
        valueSeperator = document.getElementById(file.name + "valueSeperator").value
        reader.readAsText(file)
    }
    let csvCols = document.getElementsByClassName("csvSelectionCol")

    for (const csvCol of csvCols) {
        csvCol.remove()
    }

    document.getElementById("mapProcessBtn").innerText = "Loaded"
    e.target.remove()
}


function mappingFromData(objects) {
    /*
    Fills a dynamic dict that is used to map ip addresses to hostnames and vise versa
    from the information occuring in the event data
     */
    let bad_ips = ['-', "127.0.0.1", "::1"]
    let bad_hostnames = ["-"]
    for (const data of objects) {
        //process hostnames
        let hostname = bad_hostnames.includes(data.SourceHostname) ? null : data.SourceHostname
        hostname = hostname ? hostname.toUpperCase() : null
        let ipAddress = bad_ips.includes(data.SourceIP) ? null : data.SourceIP
        createEventIDBtn(data.EventID, data.Description || "no tooltip")
        if (hostname) {
            hostname = hostname.toUpperCase()
            let list = caseData.host2ipMapper[hostname] || []
            if (ipAddress && !list.includes(ipAddress) && (data.EventID == 4624 || data.EventID == 4625)) {
                list.push(ipAddress)
                caseData.host2ipMapper[hostname] = list
                list = caseData.ip2hostMapper[ipAddress] || []
                if (!list.includes(hostname)) list.push(hostname)
                caseData.ip2hostMapper[ipAddress] = list
            }
        }
        let user = data.UserName.toUpperCase()
        if (!caseData.userNodeNames.has(user)) {
            caseData.userNodeNames.add(user)
        }
        if (data.SID && data.SID !== "-" && data.SID !== "S-1-5-18" && data.SID !== "S-1-0-0") {
            // if the username is already mapped to a SID, the SID is not changed but a console output about the conflict is generated
            let sid = data.SID.trim()
            if (caseData.userSidMapper[user]) {
                if (caseData.userSidMapper[user] !== sid) {
                    console.debug(`Conflict: User ${user} is mapped to SID ${caseData.userSidMapper[user]} and ${sid}`)
                    // console output to show the SID that is kept
                    console.debug(`Keeping ${caseData.userSidMapper[user]}`)
                }
            } else {
                caseData.userSidMapper[user] = sid
                caseData.sidUserMapper[sid] = user
            }
        }
    }
}

// #####################################################################################################################
// #####################################################################################################################
// ###################################### DATA PROCESSING ###############################################################

async function createNodesAndEdges(objects) {
    let nodeTranslation = caseData["nodeTranslation"] || new Map()
    let edgeTimeMap = caseData["hostEdgesLogonTimes"] || new Map()

    for (const data of objects) {
        if (!data.Destination) {
            console.error("No Destination in this line - will be skipped:")
            console.error(data)
            continue
        }
        let ipAddress = localIPs.includes(data.SourceIP) ? data.Destination : data.SourceIP.trim()
        if (bad_hostnames.includes(ipAddress))
            ipAddress = null
        let source = ""
        let hostname = !data.SourceHostname || bad_hostnames.includes(data.SourceHostname) ? ipAddress : data.SourceHostname
        let user = data.UserName.toUpperCase()
        let sid = data.SID ? data.SID.trim() : ""
        // when user is an SID check, if we have a mapping to an actual username and use that instead
        if (sidRegex.test(user)) {
            let tmpUsr = user
            user = caseData.sidUserMapper[user] || user
            sid = tmpUsr
        }
        let dest = data.Destination.trim()
        let distinction = data.Distinction ? data.Distinction.trim().toUpperCase() : ""
        if (!ipRegex.test(dest)) dest = dest.split(".")[0]
        dest = dest.toUpperCase()
        if (["LOCAL", "LOKAL", "127.0.0.1", "::1"].includes(hostname)) {
            hostname = dest
        }
        dest = dest.toUpperCase()
        source = hostname || ""
        source = source.trim()
        if (!ipRegex.test(source)) source = source.split(".")[0]
        source = source.toUpperCase()
        if (source && dest === "127.0.0.1")
            dest = source
        nodeTranslation.set(dest, dest)
        nodeTranslation.set(source, source)
        let description = data.Description || "-"
        let logonType = (data.LogonType || "-")
        if (source) {

            let edgeid = source + ipAddress + dest + user + sid + data.EventID + logonType + distinction + description
            let logontimes = edgeTimeMap.get(edgeid) || []
            data.LogonTimes = data.LogonTimes || []
            logontimes.push(...data.LogonTimes)
            logontimes = logontimes.sort((a, b) => {
                return new Date(a).getTime() - new Date(b).getTime()
            })
            logontimes = [...new Set(logontimes)] // remove duplicates
            edgeTimeMap.set(edgeid, logontimes)
            let edge = {
                "data": {
                    "id": edgeid,
                    "source": source,
                    "target": dest,
                    "objid": edgeid,
                    "elabel": user,
                    "label": "Event",
                    "mod": "System",
                    "distance": 15,
                    "ntype": "edge",
                    "eid": data.EventID,
                    "count": caseData.hostEdgesLogonTimes.get(edgeid).length,
                    "eventSource": source,
                    "Distinction": distinction,
                    "edge_color": edge_color,
                    "ecolor": ecolor,
                    "EventTimes": caseData.hostEdgesLogonTimes.get(edgeid) || [],
                    "UserName": user,
                    "SID": sid || "-",
                    "IP": data.SourceIP || "-",
                    "EventID": data.EventID,
                    "LogonType": logonType,
                    "Description": description,
                }
            }
            caseData.hostEdges = new Set([...caseData.hostEdges].filter(e => {
                return e.data.id !== edgeid
            }))
            caseData.hostEdges.add(edge)
        }
//############################## USER EDGES ############################################
        if (user) {
            sid = data.SID || "-"
            let uedgeid = user + source + dest + data.EventID + logonType + distinction + sid + data.Description

            let times = caseData.userEdgesLogonTimes.get(uedgeid) || []
            times.push(...data.LogonTimes)
            times = times.sort((a, b) => {
                return new Date(a).getTime() - new Date(b).getTime()
            })
            times = [...new Set(times)] // remove duplicates
            caseData.userEdgesLogonTimes.set(uedgeid, times)
            let userEdge = {
                "data": {
                    "id": uedgeid,
                    "source": user,
                    "target": dest,
                    "objid": uedgeid,
                    "elabel": data.EventID,
                    "label": "Event",
                    "mod": "User",
                    "distance": 5,
                    "ewidth": 0.1,
                    "ntype": "edge",
                    "eventSource": source,
                    "eid": data.EventID,
                    "count": times.length,
                    "Distinction": distinction,
                    "edge_color": edge_color,
                    "ecolor": ecolor,
                    "EventTimes": caseData.userEdgesLogonTimes.get(uedgeid) || [],
                    "UserName": user,
                    "SID": sid || "-",
                    "EventID": data.EventID,
                    "LogonType": logonType,
                    "Description": description,
                }
            }
            caseData.userEdges = new Set([...caseData.userEdges].filter(e => e.data.id !== uedgeid))
            caseData.userEdges.add(userEdge)
        }
    }
}

async function resolveIP2Host() {
    console.debug("ip resolver called")
    for (const [key, value] of caseData.nodeTranslation) {
        if (ipRegex.test(key)) {
            if (caseData.ip2hostMapperFromFile[key])
                caseData.nodeTranslation.set(key, caseData.ip2hostMapperFromFile[key][0])
            else {
                let selection = await getIPsHost(key)
                if (selection === -999) return // cancel all (the cancel button returns -999)
                if (selection) caseData.nodeTranslation.set(key, selection) // skip if no selection was made
            }
        }
    }
    // apply filters again to update the graph
    createQuery()
}

function trimDomainNodesNames() {
    caseData.nodeTranslation.forEach((key, value) => {
        if (!ipRegex.test(key) && key.includes(".") && key === value) {
            caseData.nodeTranslation.set(key, key.split(".")[0])
        }
    })
}

function replaceNodeNamesClick() {
    let oldNameInput = document.getElementById("oldNodeName")
    let newNodeInput = document.getElementById("newNodeName")
    let oldName = oldNameInput.value
    let newName = newNodeInput.value
    if (!oldName || !newName) {
        console.debug("Error in replaceNodeNames: oldName or newName is empty")
        return
    }
    caseData.nodeTranslation.set(oldName, newName.toUpperCase())
    oldNameInput.value = ""
    newNodeInput.value = ""
    processFilteredEdgesToNodes()
}

function validateDataInputData(data) {
    /*
    * validate the data input data for having at least UserName, Destination, EventID
    *  and one of SourceHostname, SourceIP set.
    * */

    if (!data.UserName || !data.Destination || !data.EventID || (!data.SourceHostname && !data.SourceIP)) {
        console.warn("Data is missing in this line:")
        console.warn(data)
        return false
    }
    return true
}

function parseDataFromJSON(jsonText) {
    /*
    This function is called when the user uploads the Event file to directly parse each line into the objects array
    for further processing
    */
    let objects = []
    let json_objects = jsonText.split("\n")
    for (const line of json_objects) {
        let data = {}
        try {
            data = JSON.parse(line)
            if (validateDataInputData(data))
                objects.push(data)
        } catch (error) {
            console.debug("trying to process data as exported by defender query...")
            try {
                line_ = line.replaceAll('""', '"').replace('"{', '{').replace('}"', '}')
                data = JSON.parse(line_)
                if (validateDataInputData(data))
                    objects.push(data)
            } catch (error) {
                console.debug("Error processing this line:")
                console.debug(line_)
            }
        }
    }
    return objects
}

async function processJSONUpload(results) {
    /*
    This function is called when the user uploads the Event file.
    It reads the uploaded file and creates the nodes and edges for the graph for the user display directly
     */
    //let objects = []
    let objects = await parseDataFromJSON(results)
    await mappingFromData(objects)

    await createNodesAndEdges(objects)
    processEdgesToNodes()
}

function processEdgesToNodes() {
    if (document.getElementById("modeUser").checked) {
        current_edges = caseData.userEdges
        prepareUserNodesAndEdges(current_edges).then((nande) => {
            setNodesAndEdges(nande.nodes, nande.edges)
        })

    } else {
        current_edges = caseData.hostEdges
        prepareHostNodesAndEdges(current_edges).then((nande) => {
            setNodesAndEdges(nande.nodes, nande.edges)
        })
    }
}

function processFilteredEdgesToNodes() {
    if (document.getElementById("modeUser").checked)
        prepareUserNodesAndEdges(filtered_edges).then(nande => {
            setNodesAndEdges(nande.nodes, nande.edges)
        })
    else {
        prepareHostNodesAndEdges(filtered_edges).then(nande => {
            setNodesAndEdges(nande.nodes, nande.edges)
        })
    }
}

function loadClientInfo(results) {
    /*
    This function is called when the user uploads the clientInfo.json file.
     */
    let json_objects = results.split("\n")
    for (const line of json_objects) {
        try {
            let data = JSON.parse(line)
            let hostName = data.os_info.hostname.toUpperCase()
            let hostData = {os: data.os_info.release, tags: data.labels}
            for (const tag of data.labels) {
                createTagBtn(tag)
            }
            caseData.hostInfo.set(hostName, hostData)
        } catch (error) {
            console.debug("Error processing this line:")
            console.debug(line)
        }
    }
}

function mapPrePorcessBtnClick() {
    /*
    This function is called when the user clicks the "LoadMap" Button.
    It reads the uploaded file and creates the selection elements for the user to select the correct columns
     */
    let upfile = document.getElementById("hostipmap");
    let delimiterInput = document.getElementById("hostMapDelimiter")
    hostMapDelimiter = delimiterInput.value || ","
    let reader = new FileReader()
    let currentFilename = ""
    reader.addEventListener("load", (event) => {
        createCSVSelectionElements(currentFilename, getCSVColHeaderArray(event.target.result))
    })

    for (const file of upfile.files) {
        currentFilename = file.name
        reader.readAsText(file)
    }
    let loadButton = document.createElement("button")
    loadButton.innerText = "Load Host2Ip Map"
    loadButton.addEventListener("click", loadCSVButtonClick)
    loadButton.classList.add("btn")
    loadButton.classList.add("btn-info")
    document.getElementById("uploadButtons").appendChild(loadButton)
    let loadBtn = document.getElementById("mapProcessBtn")
    loadBtn.innerText = "Selected"
    loadBtn.disabled = true
    delimiterInput.disabled = true
    document.getElementById("mapname").disabled = true
    document.getElementById("mapnameBtn").disabled = true
    loadBtn.classList.remove("btn-info")
    loadBtn.classList.add("btn-success")
}


function fileUpload() {
    let uploadBtn = document.getElementById("uploadBtn")
    uploadBtn.disabled = true
    let spinner = document.createElement("span")
    spinner.classList.add("spinner-grow")
    spinner.classList.add("spinner-grow-sm")
    spinner.setAttribute("role", "status")
    spinner.setAttribute("aria-hidden", "true")
    uploadBtn.innerText = ""
    uploadBtn.innerText = "Loading..."
    uploadBtn.appendChild(spinner)

    let clientInfoFile = document.getElementById("clientInfoUpload");
    let clientInfoReader = new FileReader()
    clientInfoReader.addEventListener('load', (ev => {
        loadClientInfo(ev.target.result)
    }))
    for (const file of clientInfoFile.files) {
        clientInfoReader.readAsText(file)
    }
    let upfile = document.getElementById("lefile");
    for (const file of upfile.files) {
        let reader = new FileReader()
        reader.addEventListener('load', (event) => {
            processJSONUpload(event.target.result)
        });
        reader.readAsText(file)
    }
    //hide modal
    let modal = bootstrap.Modal.getInstance(document.getElementById('UploadEVTX'))
    modal.hide()
    uploadBtn.innerText = "Upload"
    uploadBtn.disabled = false
}
