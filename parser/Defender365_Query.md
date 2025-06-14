# Query
        let starttime = datetime("1970-01-01T00:00:00.0000000Z");
        let endtime = datetime("2270-01-01T00:00:00.0000000Z");
        let exclude_longon_types = dynamic(["Batch", "Interactive", "Unlock", "Service"]);
        DeviceLogonEvents
        | where Timestamp between (starttime .. endtime) 
        | where AccountName !startswith "umfd" and AccountName !startswith "dwm" and AccountName !endswith "$"
        | where LogonType !in (exclude_longon_types)
        | order by Timestamp asc
        | summarize LogonTimes = make_list(Timestamp) by AccountName, DeviceName, RemoteIP, RemoteDeviceName, LogonType, Protocol, InitiatingProcessFileName
        | extend Distinction=strcat(InitiatingProcessFileName, " Protocol: " , Protocol)
        | project-rename UserName=AccountName, Destination=DeviceName, EventID=LogonType, SourceIP=RemoteIP, SourceHostname=RemoteDeviceName
        | extend LogonCount="", SID=""
        | extend BlauhauntData = pack_all()
        | project BlauhauntData


Simply export it and upload it to Blauhaunt...

(Likely you have to chunk by using the starttime and endtime variable since Denfender is limited to 10k lines of export *measly*)

If the splitting by Datetime does not suite your needs, you can extend the query like this to do some kind of pageination:
        
        let exclude_longon_types = dynamic(["Batch", "Interactive", "Unlock", "Service", "Unknown"]);
        let row_start=0;
        let row_end=1000;
        let FullData=
        DeviceLogonEvents
        | where (AccountName contains "-a" or AccountName contains "external" or InitiatingProcessAccountUpn contains "-a" or InitiatingProcessAccountUpn contains "external")
        | where LogonType !in (exclude_longon_types)
        | order by Timestamp asc
        | summarize LogonTimes = make_list(Timestamp) by AccountName, DeviceName, RemoteIP, RemoteDeviceName, LogonType, Protocol, InitiatingProcessFileName
        | extend Distinction=strcat(InitiatingProcessFileName, " Protocol: " , Protocol)
        | project-rename UserName=AccountName, Destination=DeviceName, EventID=LogonType, SourceIP=RemoteIP, SourceHostname=RemoteDeviceName
        | extend LogonCount="", SID=""
        | extend BlauhauntData = pack_all()
        | project BlauhauntData
        | serialize 
        | extend row = row_number()
        | where row between(row_start..row_end);
        FullData
        | project BlauhauntData

*simply change row_start and row_end as you need it*

# IP to Host Mapping:
        DeviceLogonEvents
        | where RemoteDeviceName != ""
        | where RemoteIP !startswith "127."
        | where RemoteIP !in ("", "-")
        | project RemoteDeviceName, RemoteIP
        | summarize by RemoteDeviceName, RemoteIP

Import this into last input field:
![image](https://github.com/cgosec/Blauhaunt/assets/147876916/60983c02-e2e2-41f0-9b2c-d8953614b22d)
