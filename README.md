# Blauhaunt
A tool collection for filtering and visualizing logon events. Designed to help answering the "Cotton Eye Joe" question (Where did you come from where did you go) in Security Incidents and Threat Hunts.

***This tool is designed for experienced DFIR specialists. You may have little to none usage from it without experience in Threat Hunting*** 

## Table of Contents  
- [Get started](#get-started)
- [Integration in investigation](#integration-in-investigation)
- [Architecture](#architekture)
- [PowerShell Script](#powershell-script)
- [Velociraptor Artifact](#velociraptor-artifact)
- [Acknowledgements](#acknowledgements)

![image](https://github.com/cgosec/Blauhaunt/assets/147876916/15c59e4a-1827-4c6e-ad06-af1813966d0c)
![image](https://github.com/cgosec/Blauhaunt/assets/147876916/a262a8f1-b6e2-418a-aa0b-c85ad7e20168)
![image](https://github.com/cgosec/Blauhaunt/assets/147876916/8add5635-1ef2-417d-93e7-2fe05b40b04d)

## Get started
Running Blauhaunt is as simple as that:

open https://cgosec.github.io/Blauhaunt/app/ since there is no backend no data will leave your local system. *(third party libraries integrated and I do not take any responsibilities of their communication behavior. Imports are in the index.html file on top)*

run a cmd or bash or what ever you like...

Then:

     git clone https://github.com/cgosec/Blauhaunt
     cd Blauhaunt/app
     python -m http.server

Now you can navigate to http://localhost:8000/ in your browser and start blau haunting the baddies.

Some random test data is in the directory test_data to get started. However this is just randomly generated and nothing to start investigate with.

### Upload Data
![image](https://github.com/cgosec/Blauhaunt/assets/147876916/c1176bd5-b3e5-4208-80d6-2bdf02e218e9)
Klick "Upload Data" (surprising isn't it :-P)

![image](https://github.com/cgosec/Blauhaunt/assets/147876916/23d391c9-af24-44b2-853e-cf064eb2bcb2)
Upload the json export of the velo artifact or the result(s) of the powershell script here.
*Do not upload the client_info.json or anything in here!*

![image](https://github.com/cgosec/Blauhaunt/assets/147876916/68aa031e-6563-4531-9a5f-f7d14af41db4)
This is optional and just needed for having system tags and their os info.
Upload your client_info.json extract here. This is just an export of the Velociraptor clients() function.
Just use this query:

     SELECT * FROM clients()

and export the json

![image](https://github.com/cgosec/Blauhaunt/assets/147876916/61edef0d-96b2-40cc-ac81-2f38ada4077b)
This is optional too.
Upload a mapping for having IP-Addresses resolved to their hostnames. You need to have a file where there is one col for Hostnames and a col for IP-Addresses.
If a System has multiple IP-Addresses you can have them in this one col separated by an arbitrarily symbol e.G. "/".

Example:
| Hostname    | IP-Addresses | MaybeSomeNotNeededStuff |
| -------- | ------- | ------- |
| System_A  | 10.10.10.100    | bonjour |
| System_B | 10.10.10.100 / 10.10.20.100 | hello |
| System_C    | 10.10.10.100 | hola |

![image](https://github.com/cgosec/Blauhaunt/assets/147876916/5abba586-b386-4af6-8085-4b1d5eb85301)

Once a proper file is selected a delimiter (if non is specified a comma is expected). And click Load Map.

![image](https://github.com/cgosec/Blauhaunt/assets/147876916/086ead34-6448-48d0-8f52-7758f13cd778)
1. Choose the name of the col where the hostname is in
2. OPTIONAL: Specify if there are any entries you want to exclude from parsing e.g. lines having an "UNKNOWN" in the Hostname Ip Mapping.
3. Choose the name of the col where the IP-Address is in
4. Specify the delimiter for multiple IP-Addresses in this line
When everything is correct click ![image](https://github.com/cgosec/Blauhaunt/assets/147876916/79d13f20-8aa2-42c7-bbe6-fbfdeea8be79)

When done click ![image](https://github.com/cgosec/Blauhaunt/assets/147876916/014b2359-02ec-44b5-943b-28d8c5f61025)

![image](https://github.com/cgosec/Blauhaunt/assets/147876916/993df0ce-9f77-4117-b775-23650fd0f20d)

If everything was processed as intended you should now see the number of total nodes and edges

### Filtering

Click ![image](https://github.com/cgosec/Blauhaunt/assets/147876916/2df6081e-6041-46b6-b905-53e2fc5955d2) to open the sidebar.

![image](https://github.com/cgosec/Blauhaunt/assets/147876916/52d54b5d-c63e-4f6d-b379-9f645d26fe3c)

The User Filter applies to the users. All Usernames are set to uppercase when parsing. This is important for filtering!

![image](https://github.com/cgosec/Blauhaunt/assets/147876916/e898c429-7474-4814-8303-8ec091415013)

The Src Host Filter specifies systems from where the user initiated the connection. Filtering for Src Hosts only works when the graph is set to System ![image](https://github.com/cgosec/Blauhaunt/assets/147876916/37c81db6-75cb-4d87-b8ca-355314eeb0c6)

![image](https://github.com/cgosec/Blauhaunt/assets/147876916/aee5d6bb-e1c3-4f1d-89cb-cb210208c9de)

The Dst Host filter specifies systems that where target of logons.

![image](https://github.com/cgosec/Blauhaunt/assets/147876916/76cd7b27-e476-4bb5-8fe6-45d8983bb7e0)

Filter for a time span for activities.

![image](https://github.com/cgosec/Blauhaunt/assets/147876916/71048d37-f979-4006-bcf9-f240d90ece02)

The Daily times filter specifies from what time we are interested in the events. This is useful if nightly user logons are not common in your environment. This is regardless of the date - that means in your timespan only events that occurred during that hourly timespan are in the set. (Works over night like in the example picture too)

![image](https://github.com/cgosec/Blauhaunt/assets/147876916/923c9522-8614-444b-86fa-b5d4cbdbf4da)

This is a filter that helps to focus on the top talkers in big sets. You can specify a threshold for a minimum of outgoing connection for the source system.

![image](https://github.com/cgosec/Blauhaunt/assets/147876916/e7447115-cd1f-4455-975a-06eb066fc68c)

By default events where source and destination are the same node are not displayed. If you want to display them active it by clicking.

![image](https://github.com/cgosec/Blauhaunt/assets/147876916/c6cbe668-e6c8-4f54-b1a4-41e1085dc26b)

Filtering for EventIDs is a good idea to reduce the data. There is no difference in choosing all or none.

![image](https://github.com/cgosec/Blauhaunt/assets/147876916/17da2925-65e7-4e47-8690-fff918199d5c)

Logon Types are only relevant for 4624 or 4625 events. I assume you know them already when you are using this tool.

![image](https://github.com/cgosec/Blauhaunt/assets/147876916/0988ee19-1ec5-4fa5-b165-eb8f85c59e3a)

Filtering for Tags only is available when client infos are uploaded. Those are your tags specified in Velociraptor for the Systems. It does not have an effect if all on none are chosen.
Those apply only for the source not for the destination system.

### Source: System or User
Usually I am rather focused on system -> system activity in favour of identifying the initial access. Since there are a lot of situations you want to focus on user behavior you can choose what your source should be: System or User. 

![image](https://github.com/cgosec/Blauhaunt/assets/147876916/f14a564f-5747-4887-aa33-5b747a5a2336)

### Render Graph, Timeline or Heatmap
When your filters are set you need to press render to display the results.
![image](https://github.com/cgosec/Blauhaunt/assets/147876916/c35535fa-4a23-4437-8abd-15c630b57050)

#### Graph
comming soon

#### Timeline
comming soon

#### Heatmap
comming soon

If you want to change from one view to another: choose the view you need and then click render.
'Be careful with Timeline! Few nodes and edges can still have a huge timeline!* Checking the Stats ![image](https://github.com/cgosec/Blauhaunt/assets/147876916/29429607-9a31-4633-a86e-70a9b70fa5ee) is a good idea before rendering a timeline.

### Graph Style
comming soon

### Tag vizualisation
comming soon

### Exports
comming soon

### Stats
comming soon

### Node information
comming soon

### Edge information
comming soon

## Integration in investigation
I recommend using Blauhaunt with [Velociraptor](https://github.com/Velocidex/velociraptor) since it is the fastest way to get data from multiple systems. The Blauhaunt import format for event data and client info is the one that can be exported from Velo.
The blauhaunt_script.ps1 works well if you prefer working with e.g. [KAPE](https://www.kroll.com/en/insights/publications/cyber/kroll-artifact-parser-extractor-kape) triage data.

Blauhaunt really gets useful if you have multiple systems to identify your next pivot system or sus users. Blauhaunt standalone will not magically bring you to the compromised systems and users. But if you have hundreds of systems to check it really speeds up your game.

### Example workflow

#### Known compromised system
(e.g. from a Velo hunt) -> Check in Blauhaunt what users connected to this system -> sus user -> sus systems -> further sus users -> the story goes on. You have good chances identifying the systems where deeper forensics will speed you up in your hunt.
If you e.g. identify compromised users on that system again you can go back to Blauhaunt and repeat the game.

#### No idea where to start
With several filters Blauhaunt gives you statistical and visual possibilities identifying unusual connections. You can e.g. check for user activities occurring at night. Or simply see a logon fire coming form a system where an attacker is enumerating the AD-Infrastructure.

#### Lucky shot
If you are really lucky and have a noisy attacker + solid administration in the network, Blauhaunt can potentially deliver you an optical attack map with the timeline of compromised systems along the y-axis in the center.

## Architecture
Blauhaunt is designed to run entirely without a backend system.
I suggest simply starting a python http server on the local system from a shell in the directory where the index.html is in with this command:

     python -m http.server
     
if you are using linux likely you have to type python3 instead of python - but if you are using this tool you should be technical skilled enough to figure that out yourself ;)

*Some day I will create a backend in Django with an API to get realtime data to display for better threat hunting*

### Default Layout
The layout of the graph is calculated according to the set filters. 
The icon size of a node is calculated by its activities within the set filters.
The x-axis position of a node is calculated by its outgoing connections. Nodes having many outgoing connections are rather in the center of the graph. Nodes with fewer outgoing connections are at the left and the right of the graph.
The y-axis is calculated by the first quatile of the nodes activity time.

To not have too many nodes at the same spot there is some movement when there are too many on the same spot.

The other layouts are defaults from the cytoscape universe that can be chosen as well.

### Filters
description comming soon

### Displays
description comming soon

### General Data Schema
There are three types of data - only the event data is mandatory

#### Event Data
This is the input Schema for the Event data that is needed by Blauhaunt to process it:

     {
        "LogonTimes":[
            "2023-07-28T20:30:19Z",
            "2023-07-27T21:12:12Z",
            "2023-07-27T21:10:49Z"
            ],
        "UserName":"Dumdidum",
        "SID":"-",
        "Destination":"Desti-LAPTOP",
        "Description":"using explicit credentials",
        "Distinction": "SomeCustomFieldToDistionctEdgesAndFilterFor"
        "EventID":4648,
        "LogonType":"-",
        "SourceIP":"-",
        "SourceHostname":"Sourci-LAPTOP",
        "LogonCount":3
        }
***To correctly process the files each dataset starting with { and ending with } must be in a new line***

#### Client Info
     {
        "os_info": {
             "hostname": "Desti-LAPTOP"
             "release": "Windows 10"
        },
        "labels": [
             "Touched",
             "C2",
             "CredDumped"
             ]
        }
***To correctly process the files each dataset starting with { and ending with } must be in a new line***


#### Host IP Mapping
Can be any CSV File. Delimiter can be specified and cols for Hostname and IP can be choosen


## PowerShell Script
blauhaunt_script.ps1
If you face any issues with execution policy the easiest thing to do is to spawn a powershell with execution policy bypass like this:

     PowerShell.exe -ExecutionPolicy Bypass powershell

To get information about usage and parameters use Get-Help

     Get-Help blauhaunt_script.ps1 -Detailed

### Usage
![image](https://github.com/cgosec/Blauhaunt/assets/147876916/3cbe2fc9-ccb3-411d-bccb-d46dc2a69484)

Depending on the size, StartDate and EndDate this can take quiet some time so be a little patient 

## Velociraptor Artifact
This speeds up collecting the relevant data on scale. 
I recommend creating a notebook (template may be provided soon here too) where all the results are listed.
You can simply take the json export from this artefact to import it into Blauhaunt

The client_info import is designed to work directly with the client_info from Velociraptor too. You can simply export the json file and upload it into Blauhaunt.

### Usage
_Comming soon: how to use Blauhaunt in Velo GUI_

If you want to parse event logs collected from a system offline using velociraptor, you can do so like this:

     .\velociraptor*.exe artifacts --definitions Blauhaunt\parser\velociraptor\ collect --format=jsonl Custom.Windows.EventLogs.Blauhaunt --args Security='C:\my\awesome\storage\path\Security.evtx' --args System='C:\my\awesome\storage\path\System.evtx' --args LocalSessionManager='C:\my\awesome\storage\path\Microsoft-Windows-TerminalServices-LocalSessionManager%4Operational.evtx' --args RemoteConnectionManager='C:\my\awesome\storage\path\Microsoft-Windows-TerminalServices-RemoteConnectionManager%4Operational.evtx' --args RDPClientOperational='C:\my\awesome\storage\path\Microsoft-Windows-TerminalServices-RDPClient%4Operational.evtx'

If you dislike typing long paths, feel free to use the provided quick script:
 
     .\quick_velo.ps1 -EventLogDirectory C:\my\awesome\storage\path 

## Acknowledgements
 - [SEC Consult](https://sec-consult.com/de/) This work was massively motivated by my work in and with the SEC Defence team
 - [Velociraptor](https://github.com/Velocidex/velociraptor/) is the game changer making it possible to collect the data to display at scale (tested with > 8000 systems already!)
 - [Cytoscape.js](https://js.cytoscape.org/) is the library making the interactive graph visualisation possible
 - [LogonTracer](https://github.com/JPCERTCC/LogonTracer) inspired the layout and part of the techstack of this project
 - [CyberChef](https://gchq.github.io/CyberChef/) inspired the idea of creating a version of Blauhaunt running without backend system all browser based


(The icon is intentionally shitty - this is how I actually look while hunting... just the look in the face not the big arms though :-P )
