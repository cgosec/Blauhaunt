/* ==========================================================================
   Blauhaunt - Explain mode
   When enabled via the navbar toggle, hovering any component shows a
   styled tooltip describing what it does. Explanations are read from
   `data-explain` attributes and, as a fallback, from existing `title`
   attributes (which are temporarily removed to avoid duplicate native
   tooltips, then restored when explain mode is turned off).
   ========================================================================== */
(function () {
    "use strict";

    let explainMode = false;
    let tip = null;
    let banner = null;

    // Curated explanations for the main components (keyed by element id).
    // These enrich elements that only had terse or missing titles.
    const EXPLANATIONS = {
        // --- Top navigation ---
        "uploadModalBtn": "Upload the JSON exported from the Lateral Movement artefact, optional Velociraptor client() info and an optional host↔IP mapping CSV. This is where you bring data into Blauhaunt.",
        "currentDisplayBtn": "Render the current graph. Click this after changing filters or the visualisation type to redraw the stage.",
        "currentDisplay": "Choose how the data is visualised: Graph (nodes & edges), Timeline (events over time) or Heatmap (activity intensity).",
        "findPathBtn": "Find and highlight a connection path between two systems – useful to trace how an attacker could have moved laterally from A to B.",
        "findPathSrcSystem": "The system the path search starts from (source).",
        "findPathDstSystem": "The system the path search should reach (destination).",
        "currentGraph": "Pick the graph layout algorithm (calculated, grid, cose, circle, tree or concentric). Different layouts make different structures easier to read.",
        "modeSystem": "System view: systems are the nodes and the users that logged on between them become the edges.",
        "modeUser": "User view: users are the source nodes pointing to every system they touched.",
        "nodeNamesBtn": "Rename or clean up node names: trim the domain suffix or manually map an old name to a new one. Click Resolve to apply.",
        "trimNodeDomain": "Remove the domain part from every node name (e.g. host.corp.local → host).",
        "oldNodeName": "The existing node name you want to replace.",
        "newNodeName": "The new name to display for that node.",
        "tagColorDropdown": "Assign colours to tags so tagged systems/users stand out in the graph.",
        "casesDropdown": "Save the current dataset and analysis as a named case, or load a previously stored case from the browser database.",
        "newCaseName": "Name for the case you are about to save locally.",
        "navbarDropdown": "Export the current view: the timeline as CSV, the graph as JSON, or a PNG/JPEG image.",
        "darkSwitch": "Toggle between light and dark appearance.",

        // --- Filter sidebar ---
        "highlightedEdgesOnly": "Show only edges you have highlighted. Hold CTRL and click an edge (or a hover element) to highlight it permanently.",
        "selfCon": "Include connections where the source and target are the same system (self-connections).",
        "queryUser": "Filter accounts by regular expression. Press CTRL+Q to reuse a previous search.",
        "queryHostSrc": "Filter source hosts by regular expression. Press CTRL+B to reuse a previous search.",
        "queryHostDst": "Filter destination hosts by regular expression. Press CTRL+Y to reuse a previous search.",
        "queryDistinction": "Custom regular expression to further distinguish connections.",
        "invertUserRegex": "Invert the user filter – matching users are excluded instead of included.",
        "invertSrcHostRegex": "Invert the source-host filter – matching hosts are excluded.",
        "invertDstHostRegex": "Invert the destination-host filter – matching hosts are excluded.",
        "invertDistinctionRegex": "Invert the custom distinction filter – matches are excluded.",
        "timeOffsetList": "Apply a timezone offset to filters and the timeline. Raw timestamps in node/edge lists stay in UTC (Z).",
        "from-date": "Only show events at or after this date/time.",
        "to-date": "Only show events at or before this date/time.",
        "filterForWeekendsCkbx": "Only show connections that happened on a Saturday or Sunday.",
        "from-clock": "Show only events that occurred at or after this time of day (any date).",
        "to-clock": "Show only events that occurred at or before this time of day (any date).",
        "minOutgoingConnections": "Minimum number of distinct systems a source must connect to before it is shown. Applied after the other filters.",
        "applyAllTags": "Select or unselect every tag filter at once.",

        // --- Stats sidebar ---
        "sysTable": "Per-system statistics: how many systems it reaches, is reached by, and how many users flow in and out.",
        "userTable": "Per-user statistics: how many systems each account connected to.",

        // --- Upload modal ---
        "lefile": "Choose one or more event-log JSON files exported from the Lateral Movement artefact.",
        "clientInfoUpload": "Optionally add Velociraptor client() output to enrich systems with host information.",
        "hostipmap": "Optionally load a CSV mapping hostnames to IP addresses so IPs resolve to friendly names.",
        "hostMapDelimiter": "The column delimiter used in your host/IP mapping CSV (default is a comma).",
        "uploadBtn": "Start importing the selected files into Blauhaunt."
    };

    function getExplanation(el) {
        // Prefer an explicit data-explain, then the curated map, then title.
        return (
            el.getAttribute("data-explain") ||
            (el.id && EXPLANATIONS[el.id]) ||
            el.getAttribute("data-bh-title") ||
            el.getAttribute("title") ||
            ""
        );
    }

    // Walk up a few levels so hovering a label/icon inside a control still works.
    function findExplainTarget(node) {
        let el = node;
        let depth = 0;
        while (el && el !== document.body && depth < 4) {
            if (el.nodeType === 1) {
                const text = getExplanation(el);
                if (text && text.trim()) {
                    return {el: el, text: text.trim()};
                }
            }
            el = el.parentElement;
            depth++;
        }
        return null;
    }

    function ensureTip() {
        if (!tip) {
            tip = document.createElement("div");
            tip.id = "bhExplainTip";
            document.body.appendChild(tip);
        }
        return tip;
    }

    function showTip(text, x, y) {
        const t = ensureTip();
        t.innerHTML = '<span class="bh-tip-title"><i class="fa fa-circle-info"></i> What is this?</span>' + escapeHtml(text);
        positionTip(x, y);
        t.classList.add("show");
    }

    function positionTip(x, y) {
        const t = ensureTip();
        const pad = 14;
        const rect = t.getBoundingClientRect();
        let left = x + pad;
        let top = y + pad;
        if (left + rect.width + pad > window.innerWidth) {
            left = x - rect.width - pad;
        }
        if (top + rect.height + pad > window.innerHeight) {
            top = y - rect.height - pad;
        }
        t.style.left = Math.max(pad, left) + "px";
        t.style.top = Math.max(pad, top) + "px";
    }

    function hideTip() {
        if (tip) {
            tip.classList.remove("show");
        }
    }

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML.replace(/\n/g, "<br>");
    }

    // Move all `title` attributes aside while explain mode is active so the
    // browser's native tooltip doesn't compete with ours. Restore afterwards.
    function stashTitles() {
        document.querySelectorAll("[title]").forEach(function (el) {
            el.setAttribute("data-bh-title", el.getAttribute("title"));
            el.removeAttribute("title");
        });
    }

    function restoreTitles() {
        document.querySelectorAll("[data-bh-title]").forEach(function (el) {
            if (!el.hasAttribute("title")) {
                el.setAttribute("title", el.getAttribute("data-bh-title"));
            }
            el.removeAttribute("data-bh-title");
        });
    }

    let currentTarget = null;

    function onMouseOver(ev) {
        if (!explainMode) return;
        const hit = findExplainTarget(ev.target);
        if (hit) {
            currentTarget = hit.el;
            showTip(hit.text, ev.clientX, ev.clientY);
        } else {
            currentTarget = null;
            hideTip();
        }
    }

    function onMouseMove(ev) {
        if (!explainMode || !currentTarget) return;
        if (tip && tip.classList.contains("show")) {
            positionTip(ev.clientX, ev.clientY);
        }
    }

    function onMouseOut(ev) {
        if (!explainMode) return;
        if (!ev.relatedTarget || !currentTarget || !currentTarget.contains(ev.relatedTarget)) {
            hideTip();
        }
    }

    function setExplainMode(on) {
        explainMode = on;
        document.body.classList.toggle("explain-mode", on);
        if (on) {
            stashTitles();
        } else {
            restoreTitles();
            hideTip();
        }
    }

    function init() {
        // Banner shown while active.
        banner = document.createElement("div");
        banner.className = "explain-active-banner";
        banner.innerHTML = '<i class="fa fa-circle-info"></i> Explain mode on – hover any control to learn what it does';
        document.body.appendChild(banner);

        const toggle = document.getElementById("explainSwitch");
        if (toggle) {
            toggle.addEventListener("change", function () {
                setExplainMode(this.checked);
            });
        }

        document.addEventListener("mouseover", onMouseOver, true);
        document.addEventListener("mousemove", onMouseMove, true);
        document.addEventListener("mouseout", onMouseOut, true);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
