let other_edge = {
    "data": {
        "id": objid,
        "source": parseInt(path[parseInt(idx) - 1].identity.low) + 100,
        "target": parseInt(path[parseInt(idx) + 1].identity.low) + 100,
        "objid": objid,
        "label": path[idx].type,
        "distance": 5,
        "ntype": "edge",
    }
}

let event_edge = {
    "data": {
        "id": objid,
        "source": sourceid,
        "target": targetid,
        "objid": objid,
        "elabel": ename,
        "label": path[idx].type,
        "distance": 5,
        "ntype": "edge",
        "eid": parseInt(path[idx].properties.id),
        "count": ecount,
        "logontype": String(path[idx].properties.logintype),
        "status": path[idx].properties.status,
        "authname": path[idx].properties.authname,
        "edge_color": edge_color,
        "ecolor": ecolor
    }
}

let node_object = {
    "data": {
        "id": objid,
        "objid": objid,
        "nlabel": nname,
        "ncolor": ncolor,
        "nbcolor": nbcolor,
        "nfcolor": nfcolor,
        "nwidth": nwidth,
        "nheight": nheight,
        "nfsize": nfsize,
        "nshape": nshape,
        "label": path[idx].labels[0],
        "nprivilege": nprivilege,
        "ntype": ntype,
        "nsid": path[idx].properties.user_sid,
        "nstatus": path[idx].properties.status,
        "nhostname": path[idx].properties.hostname,
        "nsub": nsub,
        "ncategory": ncategory
    }
}

let root;

function getApiData() {
    /*
    "LogonUser": "http://127.0.0.1:8000/api/v1/LogonUser/",
    "LogonIP": "http://127.0.0.1:8000/api/v1/LogonIP/",
    "LogonGroup": "http://127.0.0.1:8000/api/v1/LogonGroup/",
    "Event": "http://127.0.0.1:8000/api/v1/Event/",
    "Case": "http://127.0.0.1:8000/api/v1/Case/",
    "Date": "http://127.0.0.1:8000/api/v1/Date/",
    "PolicyChange": "http://127.0.0.1:8000/api/v1/PolicyChange/",
    "GroupPolicy": "http://127.0.0.1:8000/api/v1/GroupPolicy/",
    "Domain": "http://127.0.0.1:8000/api/v1/Domain/",
    "DeleteLog": "http://127.0.0.1:8000/api/v1/DeleteLog/"
     */
    let _nodes = {
        logonUserIds: [],
        logonIPIds: [],
        logonGroupIds: [],
        DomainIds: [],
        collection: []
    }
    let nodes = []
    let edges = []
    fetch('api/v1/LogonUser/').then((response) => response.json()).then((data) => processLogonUserNode(data, nodes))
    fetch('api/v1/LogonIP/').then((response) => response.json()).then((data) => processLogonUserNode(data, nodes))
    fetch('api/v1/LogonGroup/').then((response) => response.json()).then((data) => processLogonUserNode(data, nodes))
    fetch('api/v1/Event/').then((response) => response.json()).then((data) => processLogonUserNode(data, edges))
    // fetch('api/v1/Case/').then((response) => response.json()).then((data) => processLogonUserNode(data))
    // fetch('api/v1/Date/').then((response) => response.json()).then((data) => processLogonUserNode(data))
    fetch('api/v1/PolicyChange/').then((response) => response.json()).then((data) => processLogonUserNode(data, edges))
    fetch('api/v1/GroupPolicy/').then((response) => response.json()).then((data) => processLogonUserNode(data, edges))
    fetch('api/v1/Domain/').then((response) => response.json()).then((data) => processLogonUserNode(data, nodes))
    fetch('api/v1/DeleteLog/').then((response) => response.json()).then((data) => processLogonUserNode(data))
}

function processLogonUserNode(logonUser, nodes) {

    let rmode = document.getElementById("rankMode").checked;
    if (rmode) {
        nwidth = logonUser.rank * 80 + 20
        nheight = logonUser.rank * 80 + 20
    } else {
        nwidth = "25"
        nheight = "25"
    }
    nprivilege = "";
    nsub = "";
    ncategory = "";
    nname = logonUser.username
    nfsize = "10"
    nshape = "ellipse"
    ntype = "User"
    if (logonUser.user_rights === "system") {
        ncolor = ncolor_sys
        nbcolor = nbcolor_sys
        nfcolor = nfcolor_sys
        nprivilege = "SYSTEM"
    } else {
        ncolor = ncolor_user
        nbcolor = nbcolor_user
        nfcolor = nfcolor_user
        nprivilege = "Normal"
    }
    if (logonUser.user_status !== "-") {
        ncolor = ncolor_chenge
        nshape = "octagon"
    }
    if (root === logonUser.username) {
        nfcolor = nfcolor_root
    }

    let node_object = {
        "data": {
            "id": logonUser.id,
            "objid": "u_" + logonUser.id,
            "nlabel": nname,
            "ncolor": ncolor,
            "nbcolor": nbcolor,
            "nfcolor": nfcolor,
            "nwidth": nwidth,
            "nheight": nheight,
            "nfsize": nfsize,
            "nshape": nshape,
            "label": "User",
            "nprivilege": nprivilege,
            "ntype": ntype,
            "nsid": logonUser.user_sid,
            "nstatus": logonUser.user_status,
            // "nhostname": logonUser.hostname,
            "nsub": nsub,
            "ncategory": ncategory
        }
    }
    nodes.push(node_object)
}

function processLogonIPNode(logonIP, nodes) {
    let rmode = document.getElementById("rankMode").checked;
    if (rmode) {
        nwidth = logonIP.rank * 80 + 20
        nheight = logonIP.rank * 80 + 20
    } else {
        nwidth = "25"
        nheight = "25"
    }
    nprivilege = "";
    nsub = "";
    ncategory = "";

    nname = logonIP.ip_address
    nshape = "diamond"
    nwidth = "25"
    nheight = "25"
    nfsize = "8"
    ncolor = ncolor_host
    nbcolor = nbcolor_host
    nfcolor = nfcolor_host
    ntype = "Host"
    if (root === logonIP.ip_address) {
        nfcolor = nfcolor_root
    }

    let node_object = {
        "data": {
            "id": logonIP.id,
            "objid": "ip_" + logonIP.id,
            "nlabel": nname,
            "ncolor": ncolor,
            "nbcolor": nbcolor,
            "nfcolor": nfcolor,
            "nwidth": nwidth,
            "nheight": nheight,
            "nfsize": nfsize,
            "nshape": nshape,
            "label": "User",
            "nprivilege": nprivilege,
            "ntype": ntype,
            //"nsid": logonUser.user_sid,
            //"nstatus": logonUser.user_status,
            // "nhostname": logonUser.hostname,
            "nsub": nsub,
            "ncategory": ncategory
        }
    }
    nodes.push(node_object)
}

function processLogonGroupEdge(logonGroup, edges) {
    edges.push({
        "data": {
            "id": logonGroup.id,
            "source": "d_" + logonGroup.domain,//parseInt(path[parseInt(idx) - 1].identity.low) + 100,
            "target": "u_" + logonGroup.logon_user,//parseInt(path[parseInt(idx) + 1].identity.low) + 100,
            "objid": "g_" + logonGroup.id,
            "label": "Group",
            "distance": 5,
            "ntype": "edge",
        }
    });
}

function processDomainNode(domain, nodes) {

    nprivilege = "";
    nsub = "";
    ncategory = "";

    nname = domain.name
    nshape = "rectangle"
    nwidth = "25"
    nheight = "25"
    nfsize = "10"
    ncolor = ncolor_domain
    nbcolor = nbcolor_domain
    nfcolor = nfcolor_domain
    ntype = "Domain"

    let node_object = {
        "data": {
            "id": domain.id,
            "objid": "d_+" + domain.id,
            "nlabel": nname,
            "ncolor": ncolor,
            "nbcolor": nbcolor,
            "nfcolor": nfcolor,
            "nwidth": nwidth,
            "nheight": nheight,
            "nfsize": nfsize,
            "nshape": nshape,
            "label": "Domain",
            "nprivilege": nprivilege,
            "ntype": ntype,
            //"nsid": path[idx].properties.user_sid,
            //"nstatus": path[idx].properties.status,
            //"nhostname": path[idx].properties.hostname,
            "nsub": nsub,
            "ncategory": ncategory
        }
    }

    function processEventEdge(event, edges) {
        let label_count = document.getElementById("label-count").checked;
        let label_type = document.getElementById("label-type").checked;
        let label_authname = document.getElementById("label-authname").checked;
        let sourceid = "u_" + event.logon_user //parseInt(path[parseInt(idx) - 1].identity.low) + 100
        let targetid = "ip_" + event.logon_ip//parseInt(path[parseInt(idx) + 1].identity.low) + 100

        let filterdArray = $.grep(edges,
            function (elem, index, array) {
                return (!(elem.data.source === sourceid && elem.data.target === targetid && elem.data.label === "Event" &&
                    elem.data.eid === event.event_id && elem.data.logontype === event.logon_type &&
                    elem.data.status === event.status && elem.data.authname === event.authname));
            }
        );
        let matchArray = $.grep(edges,
            function (elem, index, array) {
                return (elem.data.source === sourceid && elem.data.target === targetid && elem.data.label === "Event" &&
                    elem.data.eid === event.event_id && elem.data.logontype === event.logon_type &&
                    elem.data.status === event.status && elem.data.authname === event.authname);
            }
        );
        let ecount = parseInt(path[idx].properties.count)
        if (Object.keys(matchArray).length) {
            ecount = ecount + parseInt(matchArray[0].data.count)
        }
        edges = filterdArray
        let ename = path[idx].properties.id;
        if (label_count) {
            ename += " : " + ecount;
        }
        if (label_type) {
            ename += " : " + path[idx].properties.logintype;
        }
        if (label_authname) {
            ename += " : " + path[idx].properties.authname;
        }
        edges.push({
            "data": {
                "id": event.id,
                "source": sourceid,
                "target": targetid,
                "objid": "e_" + event.id,
                "elabel": ename,
                "label": "Event",
                "distance": 5,
                "ntype": "edge",
                "eid": event.event_id,
                "count": ecount,
                "logontype": event.logintype,
                "status": event.status,
                "authname": event.authname,
                "edge_color": edge_color,
                "ecolor": ecolor
            }
        })
    }
}

function processCase(logonCase) {

}

function processPolicyChangeNode(policyChange, nodes) {
    nname = policyChange.changetime
    nuser = policyChange.logon_user //todo why is this not in an edge???
    nsub = policyChange.sub
    ncategory = policyChange.category
    nshape = "hexagon"
    nwidth = "25"
    nheight = "25"
    nfsize = "10"
    ncolor = ncolor_id
    nbcolor = nbcolor_id
    nfcolor = nfcolor_id
    ntype = "Policy"

    let node_object = {
        "data": {
            "id": policyChange.id,
            "objid": policyChange.policy_id,
            "nlabel": nname,
            "ncolor": ncolor,
            "nbcolor": nbcolor,
            "nfcolor": nfcolor,
            "nwidth": nwidth,
            "nheight": nheight,
            "nfsize": nfsize,
            "nshape": nshape,
            "label": "ID",
            "nprivilege": nprivilege,
            "ntype": ntype,
            // "nsid": path[idx].properties.user_sid,
            // "nstatus": path[idx].properties.status,
            // "nhostname": path[idx].properties.hostname,
            "nsub": nsub,
            "ncategory": ncategory
        }
    }

    nodes.push(node_object)
}


function processGroupPolicyEdge(groupPolicy, edges) {
    edges.push({
        "data": {
            "id": groupPolicy.id,
            "source": "u_" + groupPolicy.logon_user, //parseInt(path[parseInt(idx) - 1].identity.low) + 100,
            "target": groupPolicy.policy_id,//parseInt(path[parseInt(idx) + 1].identity.low) + 100,
            "objid": "gp_" + groupPolicy.id,
            "label": "GroupPolicy",
            "distance": 5,
            "ntype": "edge",
        }
    });
}


