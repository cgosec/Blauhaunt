<#
    .SYNOPSIS
    This script utilizes Get-WinEvent in serveral ways, filters and processes the data and write it into a specific json file.

    .DESCRIPTION
    https://github.com/cgosec/Blauhaunt/
    This script collects events form the local system of a given path (recursive is possible) for the use in Blauhaunt.
    Collected Security Events: 4624, 4625, 4648, 4672, 4776
    Colleced RDP Operational Events: 21
    Collected RDP Connection Events: 1149
    LogonTypes: 3,9, 10
    Microsoft-Windows-TerminalServices-LocalSessionManager%4Operational Events: 21

    .PARAMETER Path
    OPTIONAL
    Giva Path to a folder where the Security.evtx and Microsoft-Windows-TerminalServices-LocalSessionManager%4Operational.evtx is resident. If only one is present the scripts will skip the other one.
    If no Path is provided the local System Drive will be taken to seach for files in /Windows/System32/winevt/Logs/

    .PARAMETER OutPath
    OPTIONAL
    Specify the path where the output files will be written to. Do not provide file names since they are automatically generated.
    If no OutPath is provided the files are written to the current directory

    .PARAMETER StartDate
    OPTIONAL
    Format: yyyy-MM-dd
    Filter events to only process event starting from this date

    .PARAMETER EndDate
    OPTIONAL
    Format: yyyy-MM-dd
    Filter events to only process event to this date

    .PARAMETER Recursive
    OPTIONAL
    This only has effekt when -Path is set.
    If this is set the script will crawl through the folders and search for matching .evtx files to process. This is useful if you have a folder full of triage data from a DFIR investigation

    .EXAMPLE
    blauhaunt_script.ps1 -Path ./TriageLogs -Recursive -OutPath ./BlauhauntFiles/ -StartDate 2023-10-10 -EndDate 2023-10-14
    This is an example of how to use the script with different parameters.

    .NOTES
    Author: Christopher Golitschek
    Version: 0.2
    Date: 2023-10-15
    GIT: https://github.com/cgosec/Blauhaunt/
#>

param (
    [string]$Path,
    [string]$OutPath = "",
    [DateTime]$StartDate = "1970-01-01",
    [DateTime]$EndDate = "2200-01-01",
    [switch]$Recursive = $False
 )

# Specify the security event IDs to filter
$securityEventIds = @(4624, 4625, 4648, 4776, 4672)
$operationEventIds = @(21)
$sessionEventIds = @(1149)
$logontypes = @(3, 9, 10)
$NewLine = [environment]::NewLine

Write-Output "Parameter Path: $Path"
Write-Output "Parameter Recursive: $Recursive"
Write-Output "Parameter OutPath: $OutPath"
Write-Output "Parameter StartDate: $StartDate"
Write-Output "Parameter EndDate: $EndDate"
Write-Verbose "running in verbose mode"

function Write-SecurityEvents{
    param (
        $Events
    )
    
    $Hostname = $Events[0].MachineName
    $table = $Events | ForEach-Object {
        if (($_.Id -eq 4624) -and ($logontypes -contains $_.Properties[8].Value) -and (!$_.Properties[5].Value.Split(".")[0].EndsWith("$"))){
            $entry = [PSCustomObject]@{
                'TimeCreated' = $_.TimeCreated
                'UserName' = $_.Properties[5].Value.Split(".")[0]
                'SID' = $_.Properties[4].Value
                'Destination' = $_.MachineName.Split(".")[0]
            'Description' = ""
                'EventID' = $_.Id
                'LogonType' = $_.Properties[8].Value
                'SourceIP' = $_.Properties[18].Value
                'SourceHostname' = $_.Properties[11].Value.Split(".")[0]
            }
        $entry
        }
        elseif (($_.Id -eq 4625) -and ($logontypes -contains $_.Properties[10].Value) -and (!$_.Properties[5].Value.Split(".")[0].EndsWith("$"))){
            $entry = [PSCustomObject]@{
                'TimeCreated' = $_.TimeCreated
                'UserName' = $_.Properties[5].Value.Split(".")[0]
                'SID' = $_.Properties[4].Value
                'Destination' = $_.MachineName.Split(".")[0]
            'Description' = ""
                'EventID' = $_.Id
                'LogonType' = $_.Properties[10].Value
                'SourceIP' = $_.Properties[19].Value
                'SourceHostname' = $_.Properties[13].Value.Split(".")[0]
            }
        $entry
        }
        elseif ($_.Id -eq 4648 -and (!$_.Properties[5].Value.Split(".")[0].EndsWith("$"))){
            if ($_.Properties[8].Value -eq "localhost"){
                        $dst = $_.MachineName.Split(".")[0]
            }
            else {
                $dst = $_.Properties[8].Value.Split(".")[0]
            }
            $entry = [PSCustomObject]@{
                'TimeCreated' = $_.TimeCreated
                'UserName' = $_.Properties[5].Value.Split(".")[0]
                'SID' = "-"
                'Destination' = $dst
                'Description' = "Using explicied credentials"
                'EventID' = $_.Id
                'LogonType' = "-"
                'SourceIP' = $_.Properties[12].Value
                'SourceHostname' = $_.MachineName.Split(".")[0]
            }
        $entry
        }
        elseif ($_.Id -eq 4776 -and (!$_.Properties[1].Value.Split(".")[0].EndsWith("$"))){
            if (!$_.Properties[3].Value -eq 0) {
                $EventID = "4776(0x" + $_.Properties[3].Value.ToString("X") + ")"
                }
            else {
                $EventID = 4776
            }
            $entry = [PSCustomObject]@{
                'TimeCreated' = $_.TimeCreated
                'UserName' = $_.Properties[1].Value.Split(".")[0]
                'SID' = "-"
                'Destination' = $_.MachineName.Split(".")[0]
                'Description' = $_.Properties[3].Value
                'EventID' = $EventID
                'LogonType' = "-"
                'SourceIP' = ""
                'SourceHostname' = $_.Properties[2].Value.Split(".")[0]
            }
        $entry
        }
    elseif ($_.Id -eq 4672 -and (!$_.Properties[1].Value.Split(".")[0].EndsWith("$"))){
        $entry = [PSCustomObject]@{
            'TimeCreated' = $_.TimeCreated
            'UserName' = $_.Properties[1].Value.Split(".")[0]
            'SID' = $_.Properties[0].Value
            'Destination' = $_.MachineName.Split(".")[0]
            'Description' = $_.Properties[4].Value
            'EventID' = $_.Id
            'LogonType' = "-"
            'SourceIP' = ""
            'SourceHostname' = ""
        }
    $entry
    }
}
    $grouped = ""
    $grouped += $table | Group-Object -Property UserName, SID, SourceIP, EventID, LogonType, SourceIP, SourceHostname | ForEach-Object {
        $g = $_.Group[0]
        [System.Collections.ArrayList]$times = @()
        $times += $table | ForEach-Object {
                if (($g.UserName -eq $_.UserName) -and ($g.SID -eq $_.SID) -and ($g.Destination -eq $_.Destination) -and ($g.EventID -eq $_.EventID) -and ($g.LogonType -eq $_.LogonType) -and ($g.SourceIP -eq $_.SourceIP) -and ($g.SourceHostname -eq $_.SourceHostname)){
                    $_.TimeCreated.ToString("yyyy-MM-ddTHH:mm:ssZ")
                }
        }

        $entry = [PSCustomObject]@{
            'LogonTimes' = $times
                'UserName' = $g.UserName
                'SID' = $g.SID.Value
                'Destination' = $g.Destination
            'Description' = $g.Description
                'EventID' = $g.EventID
                'LogonType' = $g.LogonType
                'SourceIP' = $g.SourceIP
                'SourceHostname' = $g.SourceHostname
            'LogonCount' = $times.Count
        }
        $line = $entry | ConvertTo-Json -compress
        $line = $line.Trim()
        $line += $NewLine
        $line
    }
    $results = $grouped
    $file = $OutPath + "BlauHaunt_" + $Hostname + "_Security" + ".json"
    $counter = 1
    while  (Test-Path $file -PathType leaf) {
        $file = $OutPath + "BlauHaunt_" + $Hostname + "_Security_" + $counter + ".json"
        $counter++
    }
    $results | Out-File -FilePath $file -Encoding ascii
}

function Write-RDPEvents {
    param (
        $Events
    )
    $Hostname = $Events[0].MachineName
    $table = $Events | ForEach-Object {
        if ((@(21) -contains $_.Id)){
            [xml]$data = $_.ToXml()
            $user = $data.Event.UserData.EventXML.User.Split("\\")
            $user = $user[$user.Count-1]
            $ip = $data.Event.UserData.EventXML.Address
            $destination = $data.Event.System.Computer.Split(".")[0]
            $source = "-"
            if (@("LOCAL", "LOKAL", "127.0.0.1") -contains $ip){
                $source = $destination
                $ip = "-"
            }
            $entry = [PSCustomObject]@{
                        'TimeCreated' = $_.TimeCreated
                        'UserName' = $user
                        'SID' = "-"
                        'Destination' = $destination
                'Description' = ""
                        'EventID' = $_.Id
                        'LogonType' = ""
                        'SourceIP' = $ip
                        'SourceHostname' = $source
                    }
        $entry
        }
    }

    $grouped = ""
    $grouped += $table | Group-Object -Property UserName, SID, SourceIP, EventID, LogonType, SourceIP, SourceHostname | ForEach-Object {
        $g = $_.Group[0]
        [System.Collections.ArrayList]$times = @()
        $times += $table | ForEach-Object {
                if (($g.UserName -eq $_.UserName) -and ($g.SID -eq $_.SID) -and ($g.Destination -eq $_.Destination) -and ($g.EventID -eq $_.EventID) -and ($g.LogonType -eq $_.LogonType) -and ($g.SourceIP -eq $_.SourceIP) -and ($g.SourceHostname -eq $_.SourceHostname)){
                    $_.TimeCreated.ToString("yyyy-MM-ddTHH:mm:ssZ")
                }
        }

        $entry = [PSCustomObject]@{
            'LogonTimes' = $times
                'UserName' = $g.UserName
                'SID' = $g.SID.Value
                'Destination' = $g.Destination
            'Description' = $g.Description
                'EventID' = $g.EventID
                'LogonType' = $g.LogonType
                'SourceIP' = $g.SourceIP
                'SourceHostname' = $g.SourceHostname
            'LogonCount' = $times.Count
        }
        $line = $entry | ConvertTo-Json -compress
        $line = $line.Trim()
        $line += $NewLine
        $line
    }
    $results = $grouped
    $file = $OutPath + "BlauHaunt_" + $Hostname + "_RDP" + ".json"
    $counter = 1
    while  (Test-Path $file -PathType leaf) {
        $file = $OutPath + "BlauHaunt_" + $Hostname + "_RDP_" + $counter + ".json"
        $counter++
    }
    $results | Out-File -FilePath $file -Encoding ascii
}

function Write-RDPConnectionEvents {
    param (
        $Events
    )
    $Hostname = $Events[0].MachineName
    $table = $Events | ForEach-Object {
        if ((@(1149) -contains $_.Id)){
            $user = $_.Properties[0].value.Split("\\")
            $user = $user[$user.Count-1]
            $ip = $_.Properties[2].value
            $destination = $_.MachineName.Split(".")[0]
            $source = "-"
            if (@("LOCAL", "LOKAL", "127.0.0.1") -contains $ip){
                $source = $destination
                $ip = "-"
            }
            $entry = [PSCustomObject]@{
                        'TimeCreated' = $_.TimeCreated
                        'UserName' = $user
                        'SID' = "-"
                        'Destination' = $destination
                'Description' = ""
                        'EventID' = $_.Id
                        'LogonType' = ""
                        'SourceIP' = $ip
                        'SourceHostname' = $source
                    }
        $entry
        }
    }

    $grouped = ""
    $grouped += $table | Group-Object -Property UserName, SID, SourceIP, EventID, LogonType, SourceIP, SourceHostname | ForEach-Object {
        $g = $_.Group[0]
        [System.Collections.ArrayList]$times = @()
        $times += $table | ForEach-Object {
                if (($g.UserName -eq $_.UserName) -and ($g.SID -eq $_.SID) -and ($g.Destination -eq $_.Destination) -and ($g.EventID -eq $_.EventID) -and ($g.LogonType -eq $_.LogonType) -and ($g.SourceIP -eq $_.SourceIP) -and ($g.SourceHostname -eq $_.SourceHostname)){
                    $_.TimeCreated.ToString("yyyy-MM-ddTHH:mm:ssZ")
                }
        }

        $entry = [PSCustomObject]@{
            'LogonTimes' = $times
                'UserName' = $g.UserName
                'SID' = $g.SID.Value
                'Destination' = $g.Destination
            'Description' = $g.Description
                'EventID' = $g.EventID
                'LogonType' = $g.LogonType
                'SourceIP' = $g.SourceIP
                'SourceHostname' = $g.SourceHostname
            'LogonCount' = $times.Count
        }
        $line = $entry | ConvertTo-Json -compress
        $line = $line.Trim()
        $line += $NewLine
        $line
    }
    $results = $grouped
    $file = $OutPath + "BlauHaunt_" + $Hostname + "_RDPCon" + ".json"
    $counter = 1
    while  (Test-Path $file -PathType leaf) {
        $file = $OutPath + "BlauHaunt_" + $Hostname + "_RDPCon_" + $counter + ".json"
        $counter++
    }
    $results | Out-File -FilePath $file -Encoding ascii
}

# Query security events using Get-WinEvent
 try{
    if ($Path.length -eq 0){
        Write-Output "collecting Security events from current system"
        $Drive = (Get-WmiObject Win32_OperatingSystem).SystemDrive
        $Path = $Drive + "\Windows\system32\winevt\Logs"
    }
    if ($Recursive){
        Get-ChildItem -Path $Path -Recurse -Filter Security.evtx |
        Foreach-Object {
            Write-Output "collection Security events from "$_.FullName
            $events = Get-WinEvent -FilterHashTable @{Path=$_.FullName; StartTime=$StartDate; EndTime=$EndDate; ID=$securityEventIds}
            Write-Output "Security Events collected"
            Write-SecurityEvents -Events $events
        }
    }
    else {
        Write-Output ("collecting Security events from $Path" + "\Security.evtx")
        $events = Get-WinEvent -FilterHashTable @{Path=$Path + "\Security.evtx"; StartTime=$StartDate; EndTime=$EndDate; ID=$securityEventIds}
        Write-Output "Security Events collected"
        Write-SecurityEvents -Events $events
    }
}
catch {
    Write-Output("Error on Security Events")
}

#Query RDP Events
try{
    if ($Recursive){
        Get-ChildItem -Path $Path -Recurse -Filter "Microsoft-Windows-TerminalServices-LocalSessionManager%4Operational.evtx" |
        Foreach-Object {
            Write-Output "collection LocalSessionManager events from "$_.FullName
            $events = Get-WinEvent -FilterHashTable @{Path=$_.FullName; StartTime=$StartDate; EndTime=$EndDate; ID=$operationEventIds}
            Write-Output "LocalSessionManager Events collected"
            Write-RDPEvents -Events $events
        }
    }
    else{
    Write-Output ("collecting LocalSessionManager events from $Path" + "\Microsoft-Windows-TerminalServices-LocalSessionManager%4Operational.evtx")
    $events = Get-WinEvent -FilterHashTable @{Path = $Path + "\Microsoft-Windows-TerminalServices-LocalSessionManager%4Operational.evtx"; StartTime=$StartDate; EndTime=$EndDate; ID=$operationEventIds}
    Write-Output "LocalSessionManager Events collected"
    Write-RDPEvents -Events $events
    }
}
catch {
    Write-Output("Error on RDP Events")
}
# Microsoft-Windows-TerminalServices-RemoteConnectionManager%4Operational.evtx
try{
    if ($Recursive){
        Get-ChildItem -Path $Path -Recurse -Filter "Microsoft-Windows-TerminalServices-RemoteConnectionManager%4Operational.evtx" |
        Foreach-Object {
            Write-Output "collection TerminalServices events from "$_.FullName
            $events = Get-WinEvent -FilterHashTable @{Path=$_.FullName; StartTime=$StartDate; EndTime=$EndDate; ID=$sessionEventIds}
            Write-Output "TerminalServices Events collected"
            Write-RDPConnectionEvents -Events $events
        }
    }
    else{
    Write-Output ("collecting TerminalServices events from $Path" + "\Microsoft-Windows-TerminalServices-RemoteConnectionManager%4Operational.evtx")
    $events = Get-WinEvent -FilterHashTable @{Path = $Path + "\Microsoft-Windows-TerminalServices-RemoteConnectionManager%4Operational.evtx"; StartTime=$StartDate; EndTime=$EndDate; ID=$sessionEventIds}
    Write-Output "TerminalServices Events collected"
    Write-RDPConnectionEvents -Events $events
    }
}
catch {
    Write-Output("Error on Terminal Events")
}
