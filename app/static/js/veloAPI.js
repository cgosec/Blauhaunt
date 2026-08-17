let artifactName = "Custom.Windows.EventLogs.Blauhaunt"
let monitoringArtifact = "Custom.Windows.Events.Blauhaunt"
let velo_url = window.location.origin
let BLAUHAUNT_TAG = "Blauhaunt"
let header = {}
let orgList = []
checkForVelociraptor()

// wraps fetch to handle HTTP 429 from the Velociraptor API.
// Velociraptor returns 429 in two situations:
//   1. gRPC message size limit exceeded ("received message larger than max") -
//      this is NOT a rate limit and never resolves by waiting. We retry with
//      half the requested rows instead.
//   2. genuine rate limiting (e.g. by a reverse proxy) - we honor Retry-After
//      or fall back to exponential backoff.
function fetchWithRetry(url, options, retries = 8, delay = 1000) {
    return fetch(url, options).then(response => {
        if (response.status !== 429 || retries === 0) {
            return response;
        }
        // clone so the original body stays readable for the caller
        return response.clone().text().then(body => {
            if (body.includes("larger than max")) {
                // gRPC size limit: halve the page size and retry
                let match = url.match(/([?&]rows=)(\d+)/);
                if (match) {
                    let rows = parseInt(match[2]);
                    let halved = Math.floor(rows / 2);
                    if (halved >= 50) {
                        console.debug(`Response too large for gRPC limit. Retrying with rows=${halved}`);
                        return fetchWithRetry(url.replace(/([?&]rows=)\d+/, "$1" + halved), options, retries - 1, delay);
                    }
                }
                console.error("gRPC message size limit exceeded (429). Even small pages are too large - check the row size.");
                return response;
            }
            // genuine rate limit: honor Retry-After, else exponential backoff
            let retryAfter = parseInt(response.headers.get("Retry-After"));
            let wait = isNaN(retryAfter) ? delay : retryAfter * 1000;
            console.debug(`Rate limited (429). Retrying in ${wait}ms... (${retries} retries left)`);
            return new Promise(resolve => setTimeout(resolve, wait)).then(() =>
                fetchWithRetry(url, options, retries - 1, delay * 2)
            );
        });
    });
}

function selectionModal(title, selectionList) {
    // remove duplicates from selectionList
    selectionList = [...new Set(selectionList)]
    let modal = new Promise((resolve, reject) => {
        // create modal
        let modal = document.createElement("div");
        modal.id = "modal";
        modal.className = "modal";
        let modalContent = document.createElement("div");
        modalContent.className = "modal-content";
        let modalHeader = document.createElement("h2");
        modalHeader.innerHTML = title;
        modalContent.appendChild(modalHeader);
        let modalBody = document.createElement("div");
        modalBody.className = "modal-body";
        selectionList.forEach(option => {
            let notebookButton = document.createElement("button");
            notebookButton.innerHTML = option;
            notebookButton.onclick = function () {
                modal.remove();
                return option;
            }
            modalBody.appendChild(notebookButton);
        });
        modalContent.appendChild(modalBody);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        // show modal
        modal.style.display = "block";
        // close modal when clicked outside of it
        window.onclick = function (event) {
            if (event.target === modal) {
                modal.remove();
                return null;
            }
        }
    });
    return modal;
}

function getNotebook(huntID) {
    let notebooks = []
    fetchWithRetry(velo_url + '/api/v1/GetHunt?hunt_id=' + huntID, {headers: header}).then(response => {
        return response.json()
    }).then(data => {
        let artifacts = data.artifacts;
        let notebookID = ""
        artifacts.forEach(artifact => {
            notebookID = "N." + huntID
            if (artifact === artifactName) {
                notebooks.push(notebookID);
            }
        });
        if (notebooks.length === 0) {
            return;
        }
        // if there are more notebooks wit the artifact name, show a modal to select the notebook to use
        if (notebooks.length > 1) {
            selectionModal("Select Notebook", notebooks).then(selectedNotebook => {
                if (selectedNotebook === null) {
                    return;
                }
                getCells(selectedNotebook);
            });
        } else {
            getCells(notebooks[0]);
        }
    });
}

function getCells(notebookID) {
    fetchWithRetry(velo_url + `/api/v1/GetNotebooks?notebook_id=${notebookID}&include_uploads=true`, {headers: header}).then(response => {
        // get the X-Csrf-Token form the header of the response
        localStorage.setItem('csrf-token', response.headers.get("X-Csrf-Token"))
        return response.json()
    }).then(data => {
        console.debug("Notebook Data:")
        console.debug(data)
        let cells = data.items;
        if (cells.length > 1) {
            let cellIDs = {}
            cells.forEach(cell => {
                cell.cell_metadata.forEach(metadata => {
                    let suffix = ""
                    let i = 0
                    while (cellIDs[metadata.cell_id + suffix] !== undefined) {
                        suffix = "_" + i
                    } // check if the cell_id is already in the list, if so add a suffix to it
                    cellIDs[metadata.cell_id + suffix] = {cell_id: metadata.cell_id, version: metadata.timestamp};
                });
            });
            selectionModal("Select Cell", cellIDs.keys()).then(selectedCell => {
                if (selectedCell === null) {
                    return;
                }
                updateData(notebookID, cellIDs[selectedCell].cell_id, cellIDs[selectedCell].version, localStorage.getItem('csrf-token'));
            });
        }
        cells.forEach(cell => {
            cell.cell_metadata.forEach(metadata => {
                updateData(notebookID, metadata.cell_id, metadata.timestamp, localStorage.getItem('csrf-token'));
            });
        });
    });
}

function updateData(notebookID, cellID, version, csrf_token) {
    header["X-Csrf-Token"] = csrf_token
    // fetch the current cell content first, so the existing VQL is kept
    fetchWithRetry(velo_url + `/api/v1/GetNotebookCell?notebook_id=${notebookID}&cell_id=${cellID}`, {headers: header}).then(response => {
        return response.json()
    }).then(cellData => {
        let input = cellData.input;
        // fall back to the default query if the cell has no VQL yet
        if (!input || !input.trim()) {
            input = "\n/*\n# BLAUHAUNT\n*/\nSELECT * FROM source(artifact=\"" + artifactName + "\")\n";
        }
        return fetchWithRetry(velo_url + '/api/v1/UpdateNotebookCell', {
            method: 'POST',
            headers: header,
            body: JSON.stringify({
                "notebook_id": notebookID,
                "cell_id": cellID,
                "env": [{"key": "ArtifactName", "value": artifactName}],
                "input": input,
                "type": "vql"
            })
        });
    }).then(response => {
        return response.json()
    }).then(data => {
        console.debug("Notebook Data:")
        console.debug(data)
        loadData(notebookID, data.cell_id, data.current_version);
    });
}

let dataRows = []

function setLoadingProgress(loaded, total) {
    document.getElementById("loading").style.display = "block";
    let bar = document.getElementById("loadingProgressBar");
    let text = document.getElementById("loadingProgressText");
    if (total > 0) {
        let percent = Math.min(100, Math.round(loaded / total * 100));
        bar.style.width = percent + "%";
        text.innerText = `${loaded.toLocaleString()} / ${total.toLocaleString()} rows (${percent}%)`;
    } else {
        // total unknown - fall back to a simple counter next to the spinner
        bar.style.width = "0%";
        text.innerText = `${loaded.toLocaleString()} rows loaded`;
    }
}

function hideLoading() {
    document.getElementById("loading").style.display = "none";
    document.getElementById("loadingProgressBar").style.width = "0%";
    document.getElementById("loadingProgressText").innerText = "";
}

function loadData(notebookID, cellID, version, startRow = 0, rows = 1000) {
    fetchWithRetry(velo_url + `/api/v1/GetTable?notebook_id=${notebookID}&client_id=&cell_id=${cellID}-${version}&table_id=1&TableOptions=%7B%7D&Version=${version}&start_row=${startRow}&rows=${rows}&sort_direction=false`,
        {headers: header}
    ).then(response => {
        return response.json()
    }).then(data => {
        console.debug("Cell Data:")
        console.debug(data)
        if (!data.rows) {
            console.debug("no data found")
            return;
        }
        let keys = data.columns;
        data.rows.forEach(row => {
            let rowData = JSON.parse(row.json)
            let entry = {}
            for (i = 0; i < rowData.length; i++) {
                entry[keys[i]] = rowData[i];
            }
            dataRows.push(JSON.stringify(entry));
        });
        // show progress while loading
        let nextRow = startRow + data.rows.length;
        let hasMore = data.total_rows > nextRow;
        setLoadingProgress(nextRow, data.total_rows);
        processJSONUpload(dataRows.join("\n")).then(() => {
            if (!hasMore) {
                hideLoading();
            }
        });
        // if there are more rows, load them
        if (hasMore) {
            loadData(notebookID, cellID, version, nextRow, rows);
        }
        storeDataToIndexDB(header["Grpc-Metadata-Orgid"]);
    });
}

function getHunts(orgID) {
    velo_url = window.location.origin
    const oldAPI = '/api/v1/ListHunts?count=2000&offset=0&summary=true&user_filter=';
    const newAPI = "/api/v1/GetHuntTable?version=1&start_row=0&rows=20000&sort_direction=false"
    fetchWithRetry(velo_url + newAPI, {headers: header}).then(response => {
        return response.json()
    }).then(data => {
        try {
            console.debug(data)
            let keys = data.columns;
            let huntList = []
            for (let hunt of data.rows) {
                let h = {}
                let huntData = JSON.parse(hunt.json);
                for (let i = 0; i < keys.length; i++) {
                    h[keys[i]] = huntData[i];
                }
                h.Tags = h.Tags || [] // to prevent errors when Tags is not set
                huntList.push(h);
            }
            huntList.forEach(hunt => {
                console.debug(hunt)
                console.debug(hunt.Tags.includes(BLAUHAUNT_TAG))
                if (hunt.Tags.includes(BLAUHAUNT_TAG)) {
                    console.debug("Blauhaunt Hunt found:")
                    console.debug(hunt)
                    getNotebook(hunt.HuntId);
                }
            });
        } catch (error) {
            console.debug(error)
            console.debug("error in getHunts")
        }
    })
}

function updateClientInfoData(clientInfoNotebook, cellID, version) {
    header["X-Csrf-Token"] = localStorage.getItem('csrf-token')
    fetchWithRetry(velo_url + '/api/v1/UpdateNotebookCell', {
        method: 'POST',
        headers: header,
        body: JSON.stringify({
            "notebook_id": clientInfoNotebook,
            "cell_id": cellID,
            "env": [{"key": "ArtifactName", "value": artifactName}],
            "input": "SELECT * FROM clients()\n",
            "type": "vql"
        })
    }).then(response => {
        return response.json()
    }).then(data => {
        console.debug("Notebook Data:")
        console.debug(data)
        cellID = data.cell_id;
        version = data.current_version;
        let timestamp = data.timestamp;
        loadFromClientInfoCell(clientInfoNotebook, cellID, version, timestamp);
    });
}

async function getClientInfoNotebook(){
    try {
    let response = await fetchWithRetry(velo_url + '/api/v1/GetTable?type=NOTEBOOKS&start_row=0&rows=1000&sort_direction=false', {headers: header})
    localStorage.setItem('csrf-token', response.headers.get("X-Csrf-Token"))
    let data = await response.json()
    let notebookIDCol = data.columns.indexOf("NotebookId");
    let notebookNameCol = data.columns.indexOf("Name");
    for (const row of data.rows) {
        let row_content = JSON.parse(row.json);
        if (row_content[notebookNameCol] === "Blauhaunt Clientinfo"){
            console.log("Notebook ID is: ", row_content[notebookIDCol]) 
            return row_content[notebookIDCol]
            }
        }
    }
    catch (err) {
        console.error("Could not load notebooks", err);
    }
}

async function getClientInfoFromVelo() {
    let noteBookID = await getClientInfoNotebook();
    if (!noteBookID) {
            createClientinfoNotebook();
            noteBookID = await getClientInfoNotebook();
        }
    try {
        fetchWithRetry(velo_url + `/api/v1/GetNotebooks?notebook_id=${noteBookID}`, {headers: header}).then(response => {
            localStorage.setItem('csrf-token', response.headers.get("X-Csrf-Token"))
            return response.json()
        }).then(data => {
            let notebooks = data.items;
                let clientInfoNotebook = ""
                notebooks.forEach(notebook => {
                    let notebookID = notebook.notebook_id;
                    notebook.cell_metadata.forEach(metadata => {
                        let cellID = metadata.cell_id;
                        fetchWithRetry(velo_url + `/api/v1/GetNotebookCell?notebook_id=${notebookID}&cell_id=${cellID}`, {headers: header}).then(response => {
                            return response.json()
                        }).then(data => {
                            let query = data.input;
                            if (query.trim().toLowerCase() === 'select * from clients()') {
                                let version = metadata.current_version;
                                let timestamp = metadata.timestamp;
                                updateClientInfoData(notebookID, cellID, version, timestamp);
                            }
                        });
                    });
                });
        });
        }
    catch (err){
        console.error("Error loading Clientinfo", err)
    }
}

function createClientinfoNotebook() {
    header["X-Csrf-Token"] = localStorage.getItem('csrf-token')
    fetchWithRetry("/api/v1/NewNotebook", {
        headers: header,
        "referrerPolicy": "strict-origin-when-cross-origin",
        "body": "{\"name\":\"Blauhaunt Clientinfo\",\"description\":\"Auto created\",\"public\":true,\"artifacts\":[\"Notebooks.Default\"],\"specs\":[]}",
        "method": "POST",
        "mode": "cors",
        "credentials": "include"
    }).then(response => {
        return response.json().then(data => {
            console.debug("Notebook for client info created")
            console.debug(data)
            let clientInfoNotebook = data.notebook_id;
            let cellID = data.cell_metadata[0].cell_id;
            let version = data.cell_metadata[0].current_version;
            fetchWithRetry("/api/v1/UpdateNotebookCell", {
                headers: header,
                "body": `{"notebook_id":"${clientInfoNotebook}","cell_id":"${cellID}","type":"vql","currently_editing":false,"input":"select * from clients()"}`,
                "method": "POST",
                "mode": "cors",
                "credentials": "include"
            }).then(response => {
                return response.json().then(data => {
                    console.debug("Notebook Data:")
                    console.debug(data)
                    cellID = data.cell_id;
                    version = data.current_version;
                    let timestamp = data.timestamp;
                    loadFromClientInfoCell(clientInfoNotebook, cellID, version, timestamp);
                });
            });
        })
    });
}

function loadFromClientInfoCell(notebookID, cellID, version, timestamp, startRow = 0, rows = 1000) {
    fetchWithRetry(velo_url + `/api/v1/GetTable?notebook_id=${notebookID}&client_id=&cell_id=${cellID}-${version}&table_id=1&TableOptions=%7B%7D&Version=${timestamp}&start_row=${startRow}&rows=${rows}&sort_direction=false`,
        {headers: header}
    ).then(response => {
        return response.json()
    }).then(data => {
        console.debug("Client Data:")
        console.debug(data)
        let clientIDs = []
        let keys = data.columns;
        let clientRows = []
        data.rows.forEach(row => {
            row = JSON.parse(row.json);
            let entry = {}
            for (i = 0; i < row.length; i++) {
                entry[keys[i]] = row[i];
            }
            clientRows.push(JSON.stringify(entry));
            console.debug(entry)
            clientIDs.push(entry["client_id"]);
        });
        // show loading spinner
        loadClientInfo(clientRows.join("\n"))
        caseData.clientIDs = clientIDs;
        // if there are more rows, load them
        let nextRow = startRow + data.rows.length;
        if (data.total_rows > nextRow) {
            loadFromClientInfoCell(notebookID, cellID, version, timestamp, nextRow, rows);
        }
    });

}


function getFromMonitoringArtifact() {
    let notebookIDStart = "N.E." + monitoringArtifact
    console.debug("checking for monitoring artifact data...")
    // iterate over notebooks to find the one with the monitoring artifact
    // check if caseData has clientMonitoringLatestUpdate set
    if (caseData.clientMonitoringLatestUpdate === undefined) {
        caseData.clientMonitoringLatestUpdate = {}
    }
    if (caseData.clientIDs) {
        caseData.clientIDs.forEach(clientID => {
            console.debug("checking monitoring artifact for clientID: " + clientID)
            let latestUpdate = caseData.clientMonitoringLatestUpdate[clientID] || 0;
            fetchWithRetry(velo_url + `/api/v1/GetTable?client_id=${clientID}&artifact=${monitoringArtifact}&type=CLIENT_EVENT&start_time=${latestUpdate}&end_time=9999999999&rows=10000`, {
                headers: header
            }).then(response => {
                return response.json()
            }).then(data => {
                console.debug("monitoring data for clientID: ")
                console.debug(data)
                if (data.rows === undefined) {
                    return;
                }
                let keys = data.columns;
                let rows = data.rows;
                let serverTimeIndex = data.columns.indexOf("_ts");
                let monitoringData = []
                let maxUpdatedTime = 0;
                rows.forEach(row => {
                    row = JSON.parse(row.json);
                    console.debug(`row time: ${row[serverTimeIndex]}, lastUpdatedTime: ${latestUpdate}`)
                    if (row[serverTimeIndex] > latestUpdate) {
                        if (row[serverTimeIndex] > maxUpdatedTime) {
                            console.debug("updating maxUpdatedTime to" + row[serverTimeIndex])
                            maxUpdatedTime = row[serverTimeIndex];
                        }
                        let entry = {}
                        keys.forEach((key, index) => {
                            entry[key] = row[index];
                        });
                        if (entry) {
                            console.debug(entry)
                            monitoringData.push(JSON.stringify(entry));
                        }
                    }
                });
                caseData.clientMonitoringLatestUpdate[clientID] = maxUpdatedTime;
                if (monitoringData.length > 0) {
                    console.debug("monitoring data for clientID: " + clientID + " is being processed with " + monitoringData.length + " entries")
                    processJSONUpload(monitoringData.join("\n")).then(() => {
                        console.debug("monitoring data processed");
                        storeDataToIndexDB(header["Grpc-Metadata-Orgid"]);
                    });
                }
            });
        });
    }
}

function changeBtn(replaceBtn, text, ordID) {
    let newBtn = document.createElement("button");
    // get child btn from replaceBtn and copy the classes to the new btn
    let oldBtn = replaceBtn.querySelector("button");
    newBtn.className = oldBtn ? oldBtn.className : "btn btn-secondary w-100";
    // only remove the old button so other elements (e.g. the org selection) stay intact
    if (oldBtn) {
        oldBtn.remove();
    }
    newBtn.innerText = text;
    newBtn.addEventListener("click", evt => {
        evt.preventDefault()
        getClientInfoFromVelo();
        getHunts(ordID);
    });
    replaceBtn.appendChild(newBtn)
}

function createOrgSelection(replaceBtn, currentOrgID) {
    // only shown when connected to velociraptor (called from checkForVelociraptor)
    if (orgList.length === 0) {
        return;
    }
    let select = document.createElement("select");
    select.className = "form-select mb-2";
    select.id = "orgSelection";
    orgList.forEach(org => {
        let option = document.createElement("option");
        option.value = org.id;
        option.innerText = org.name;
        if (org.id === currentOrgID) {
            option.selected = true;
        }
        select.appendChild(option);
    });
    select.addEventListener("change", evt => {
        let orgID = evt.target.value;
        let orgName = evt.target.options[evt.target.selectedIndex].text;
        header["Grpc-Metadata-Orgid"] = orgID;
        changeBtn(replaceBtn, "Load " + orgName, orgID);
        loadDataFromDB(orgID);
        getClientInfoFromVelo();
        getHunts(orgID);
    });
    replaceBtn.parentNode.insertBefore(select, replaceBtn);
}

function loadDataFromDB(orgID) {
    // check if casedata with orgID is already in indexedDB
    retrieveDataFromIndexDB(orgID);
}

function syncFromMonitoringArtifact() {
    return setInterval(getFromMonitoringArtifact, 60000);
}

function stopMonitoringAync(id) {
    clearInterval(id);
}

function createSyncBtn() {
    let syncBtn = document.createElement("input");
    /*
    <div class="form-check form-switch ms-2">
                        <input class="form-check-input" id="darkSwitch" type="checkbox">
                        <label class="form-check-label" for="darkSwitch">Dark Mode</label>
                    </div>
     */
    // add classes to make it a bootstrap toggle button
    syncBtn.className = "form-check-input";
    syncBtn.type = "checkbox";
    syncBtn.id = "syncBtn";
    let syncLabel = document.createElement("label");
    syncLabel.className = "form-check-label";
    syncLabel.innerText = "Life Data";
    syncLabel.setAttribute("for", "syncBtn");
    syncBtn.addEventListener("click", evt => {
        let syncID = syncFromMonitoringArtifact();
        evt.target.innerText = "Stop";
        evt.target.removeEventListener("click", evt);
        evt.target.addEventListener("click", evt => {
            stopMonitoringAync(syncID);
            evt.target.innerText = "Life Data";
            evt.target.removeEventListener("click", evt);
            evt.target.addEventListener("click", evt);
        });
    });
    let wrapper = document.createElement("div");
    wrapper.className = "form-check form-switch ms-2";
    wrapper.appendChild(syncBtn);
    wrapper.appendChild(syncLabel);
    document.getElementById("casesBtnGrp").innerHTML = "";
    document.getElementById("casesBtnGrp").appendChild(wrapper);
}

function checkForVelociraptor() {
    fetchWithRetry(velo_url + '/api/v1/GetUserUITraits', {headers: header}).then(response => {
        return response.json()
    }).then(data => {
        console.log("Velociraptor is connected. Loading case..:")
        console.info("Please note that the Velociraptor REST API is not officially documented and may change in future versions. Use at your own risk. If this does not work, you need to adapt the workflows in veloAPI.js to the REST API of your Velociraptor version. The code is available on GitHub:")
        console.log("Org in UserUITraits", data.interface_traits.org);
        console.log("Orgs in UserUITraits", data.orgs);
        console.debug("UserUITraits:", data);
        let orgID = data.interface_traits.org || 'root';
        // collect all orgs (id + name) the user has access to
        orgList = (data.orgs || []).map(org => {
            return {id: org.id || 'root', name: org.name || org.id || 'root'};
        });
        if (!orgList.some(org => org.id === orgID)) {
            orgList.push({id: orgID, name: orgID});
        }
        header = {"Grpc-Metadata-Orgid": orgID}
        // hide the Upload button
        let replaceBtn = document.getElementById("dataBtnWrapper");
        createOrgSelection(replaceBtn, orgID);
        changeBtn(replaceBtn, "Load " + orgID, orgID);
        loadDataFromDB(orgID);
        createSyncBtn()
        //getHunts(orgID);
    }).catch(error => {
        console.debug(error)
        console.debug("seems to be not connected to Velociraptor.");
    });
}
