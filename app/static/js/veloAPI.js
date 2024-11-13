let artifactName = "Custom.Windows.EventLogs.Blauhaunt"
let monitoringArtifact = "Custom.Windows.Events.Blauhaunt"
let velo_url = window.location.origin
let BLAUHAUNT_TAG = "Blauhaunt"
let header = {}
checkForVelociraptor()

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
    fetch(velo_url + '/api/v1/GetHunt?hunt_id=' + huntID, {headers: header}).then(response => {
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
    fetch(velo_url + `/api/v1/GetNotebooks?notebook_id=${notebookID}&include_uploads=true`, {headers: header}).then(response => {
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
    fetch(velo_url + '/api/v1/UpdateNotebookCell', {
        method: 'POST',
        headers: header,
        body: JSON.stringify({
            "notebook_id": notebookID,
            "cell_id": cellID,
            "env": [{"key": "ArtifactName", "value": artifactName}],
            "input": "\n/*\n# BLAUHAUNT\n*/\nSELECT * FROM source(artifact=\"" + artifactName + "\")\n",
            "type": "vql"
        })
    }).then(response => {
        return response.json()
    }).then(data => {
        console.debug("Notebook Data:")
        console.debug(data)
        loadData(notebookID, data.cell_id, data.current_version);
    });
}

let dataRows = []

function loadData(notebookID, cellID, version, startRow = 0, toRow = 1000) {
    fetch(velo_url + `/api/v1/GetTable?notebook_id=${notebookID}&client_id=&cell_id=${cellID}-${version}&table_id=1&TableOptions=%7B%7D&Version=${version}&start_row=${startRow}&rows=${toRow}&sort_direction=false`,
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
        // show loading spinner
        document.getElementById("loading").style.display = "block";
        processJSONUpload(dataRows.join("\n")).then(() => {
            document.getElementById("loading").style.display = "none";
        });
        // if there are more rows, load them
        if (data.total_rows > toRow) {
            loadData(notebookID, cellID, version, startRow + toRow, toRow + 1000);
        }
        storeDataToIndexDB(header["Grpc-Metadata-Orgid"]);
    });
}

function getHunts(orgID) {
    velo_url = window.location.origin
    const oldAPI = '/api/v1/ListHunts?count=2000&offset=0&summary=true&user_filter=';
    const newAPI = "/api/v1/GetHuntTable?version=1&start_row=0&rows=20000&sort_direction=false"
    fetch(velo_url + newAPI, {headers: header}).then(response => {
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
    fetch(velo_url + '/api/v1/UpdateNotebookCell', {
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

function getClientInfoFromVelo() {
    fetch(velo_url + '/api/v1/GetNotebooks?count=1000&offset=0', {headers: header}).then(response => {
        localStorage.setItem('csrf-token', response.headers.get("X-Csrf-Token"))
        return response.json()
    }).then(data => {
        let notebooks = data.items;
        if (!notebooks) {
            createClientinfoNotebook()
        } else {
            let clientInfoNotebook = ""
            notebooks.forEach(notebook => {
                let notebookID = notebook.notebook_id;
                notebook.cell_metadata.forEach(metadata => {
                    let cellID = metadata.cell_id;
                    fetch(velo_url + `/api/v1/GetNotebookCell?notebook_id=${notebookID}&cell_id=${cellID}`, {headers: header}).then(response => {
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
        }
    });
}

function createClientinfoNotebook() {
    header["X-Csrf-Token"] = localStorage.getItem('csrf-token')
    fetch("/api/v1/NewNotebook", {
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
            fetch("/api/v1/UpdateNotebookCell", {
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

function loadFromClientInfoCell(notebookID, cellID, version, timestamp, startRow = 0, toRow = 1000) {
    fetch(velo_url + `/api/v1/GetTable?notebook_id=${notebookID}&client_id=&cell_id=${cellID}-${version}&table_id=1&TableOptions=%7B%7D&Version=${timestamp}&start_row=${startRow}&rows=${toRow}&sort_direction=false`,
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
        if (data.total_rows > toRow) {
            loadFromClientInfoCell(notebookID, cellID, version, timestamp, startRow + toRow, toRow + 1000);
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
            fetch(velo_url + `/api/v1/GetTable?client_id=${clientID}&artifact=${monitoringArtifact}&type=CLIENT_EVENT&start_time=${latestUpdate}&end_time=9999999999&rows=10000`, {
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
    newBtn.className = replaceBtn.children[0].className;
    replaceBtn.innerHTML = ""
    newBtn.innerText = text;
    newBtn.addEventListener("click", evt => {
        evt.preventDefault()
        getClientInfoFromVelo();
        getHunts(ordID);
    });
    replaceBtn.appendChild(newBtn)
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
    fetch(velo_url + '/api/v1/GetUserUITraits', {headers: header}).then(response => {
        return response.json()
    }).then(data => {
        let orgID = data.interface_traits.org || 'root';
        header = {"Grpc-Metadata-Orgid": orgID}
        // hide the Upload button
        let replaceBtn = document.getElementById("dataBtnWrapper");
        changeBtn(replaceBtn, "Load " + orgID, orgID);
        loadDataFromDB(orgID);
        createSyncBtn()
        //getHunts(orgID);
    }).catch(error => {
        console.debug(error)
        console.debug("seems to be not connected to Velociraptor.");
    });
}