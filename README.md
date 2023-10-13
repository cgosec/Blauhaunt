# Blauhaunt
A tool collection for filtering and visualizing logon events. This tool has been used for threat hunting and icident respons approaches in several cases.
![image](https://github.com/cgosec/Blauhaunt/assets/147876916/15c59e4a-1827-4c6e-ad06-af1813966d0c)
![image](https://github.com/cgosec/Blauhaunt/assets/147876916/a262a8f1-b6e2-418a-aa0b-c85ad7e20168)
![image](https://github.com/cgosec/Blauhaunt/assets/147876916/8add5635-1ef2-417d-93e7-2fe05b40b04d)


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
        "LogonCount":3  # optional
        }


### Client Info
Comming soon


### Host IP Mapping
Can be any CSV File. Delimiter can be specified and cols for Hostname and IP can be choosen