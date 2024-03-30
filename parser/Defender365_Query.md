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
    | project-rename UserName=AccountName, Destination=DeviceName, EventID=Protocol, SourceIP=RemoteIP, SourceHostname=RemoteDeviceName, Distinction=InitiatingProcessFileName
    | extend Distinction = "", LogonCount="", SID=""
    | extend BlauhauntData = pack_all()
    | project BlauhauntData


Simply export it and upload it to Blauhaunt...

(Likely you have to chunk by using the starttime and endtime variable since Denfender is limited to 10k lines of export *measly*
