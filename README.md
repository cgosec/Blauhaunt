# Blauhaunt
A tool collection for filtering and visualizing logon events. Designed to help answering the "Cotton Eye Joe" question  (Where did you come from where did you go) in Security Incidents and Threat Hunts
![image](https://github.com/cgosec/Blauhaunt/assets/147876916/15c59e4a-1827-4c6e-ad06-af1813966d0c)
![image](https://github.com/cgosec/Blauhaunt/assets/147876916/a262a8f1-b6e2-418a-aa0b-c85ad7e20168)
![image](https://github.com/cgosec/Blauhaunt/assets/147876916/8add5635-1ef2-417d-93e7-2fe05b40b04d)

## Architekture
Blauhaunt is designed to run entirely without a backend system.
I suggest simply starting a python http server on the local system from a shell in the directory where the index.html is in with this command:

     python -m http.server
     
if you are using linux likely you have the type python3 instead of python - but if you are using this tool you sould be technical skilled enough to figure that out yourself ;)

*Some day I will create a backend in Django with an API to get realtime data to display for better threat hunting*

## Data Schema
There are three types of data - only the event data is mandatory

### Event Data
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
        "EventID":4648,
        "LogonType":"-",
        "SourceIP":"-",
        "SourceHostname":"Sourci-LAPTOP",
        "LogonCount":3
        }
***To correctly process the files each starting with { and ending with } must be in a new line***

### Client Info
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
***To correctly process the files each starting with { and ending with } must be in a new line***


### Host IP Mapping
Can be any CSV File. Delimiter can be specified and cols for Hostname and IP can be choosen

## Acknowledgements
 - [SEC Consult](https://sec-consult.com/de/) This work was massively motivated by my work in and with the SEC Defence team
 - [Velociraptor](https://github.com/Velocidex/velociraptor/) is the game changer making it possible to collect the data to display at scale (tested with > 6000k Systems already!) 
 - [LogonTracer](https://github.com/JPCERTCC/LogonTracer) inspired the layout and part of the techstack of this project
 - [CyberChef](https://gchq.github.io/CyberChef/) inspired the idea of creating a version of Blauhaunt running without backend system all browser based
