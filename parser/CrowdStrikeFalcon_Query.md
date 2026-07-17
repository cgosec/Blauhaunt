# Query

```
#event_simpleName = "UserLogon" or #event_simpleName = "UserLogonFailed2" |
formatTime(field="timestamp", format="\"%Y-%m-%dT%H:%M:%SZ\"", as="EventTime")
| Distinction := if(condition=regex("^1", field="UserIsAdmin"), then="Admin", else="No Admin")
| select(["EventTime", "UserName", "UserSid",  "Distinction", "RemoteIP", "ComputerName", "LogonType", "event.action"])
| groupBy(["UserName", "UserSid", "RemoteIP", "ComputerName", "Distinction", "LogonType", "event.action"], function=collect(["EventTime"]))
| LogonTimes := replace(field="EventTime", regex="\n", replacement=", ")
| format(format="[%s]", field=[LogonTimes], as="LogonTimes")
| rename(field="ComputerName", as="Destination") // "ComputerName" contains the name of the device running the falcon sensor; this is the device, where the logon is registered
| rename(field="UserSid",  as="SID") // for event "UserLogonFailed2" CrowdStrike doesnt log the user sid :/
| rename(field="event.action", as="EventID")
| rename(field="RemoteIP", as="SourceIP")
// events "UserLogon" and "UserLogonFailed2" have no information on the hostname of the connecting system
| default(value="-", field=["ComputerName", "SID", "EventID", "SourceIP", "SourceHostname", "Distinction", "LogonType", "UserName"])
| select(["LogonTimes", "UserName", "SID",  "Distinction", "SourceIP", "SourceHostname", "Destination", "LogonType", "EventID"])
```

Run this query in the "Advanced event search" and export the data as "Newline delimited JSON (ndjson)". 
You will have to adjust the timeframe for which the events will be considered (default is the last 15 minutes, likely not the relevant timeframe for you).

# IP to Host Mapping:

Switch to the "Host Management" overview and choose a CSV export with the data "Hostname" and "Local IP". The resulting CSV file can be ingested in Blauhaunt.

