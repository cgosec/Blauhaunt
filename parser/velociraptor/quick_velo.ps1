# script for when you got some event logs and you want to quickly run blauhaunt over it
# uses the blauhaunt velo artifact for data collection
# example of use: .\quick_velo.ps1 -EventLogDirectory C:\Windows\System32\winevt\Logs\
# will put the resulting json in the directory, from which the script is executed
# will overwrite previous results, if they are not renamed

[CmdletBinding()]
param(
    [Parameter(
        Mandatory = $true,
        ValueFromPipeline = $true,
        ValueFromPipelineByPropertyName = $true,
        Position = 1,
        HelpMessage = "Directory containing the event logs (evtx)")]
    [System.IO.FileInfo] $EventLogDirectory,
    [Parameter(
        Position = 2,
        HelpMessage = "Name of the output file with path (default: .\BlauhauntData.json)")]
        [System.IO.FileInfo] $OutfileName = ".\BlauhauntData.json"
)

$blauhauntArtifact = (Get-ChildItem . | Where-Object -Property Name -Like "velo_artifact.yaml").FullName
$velociraptorPath = (Get-ChildItem . | Where-Object -Property Name -Like "velociraptor*exe").FullName
"$velociraptorPath artifacts --definitions $blauhauntArtifact collect --format=jsonl Custom.Windows.EventLogs.Blauhaunt --args Security='$EventLogDirectory\Security.evtx' --args System='$EventLogDirectory\System.evtx' --args LocalSessionManager='$EventLogDirectory\Microsoft-Windows-TerminalServices-LocalSessionManager%4Operational.evtx' --args RemoteConnectionManager='$EventLogDirectory\Microsoft-Windows-TerminalServices-RemoteConnectionManager%4Operational.evtx' --args RDPClientOperational='$EventLogDirectory\Microsoft-Windows-TerminalServices-RDPClient%4Operational.evtx'" | Invoke-Expression | Out-File -FilePath $OutfileName
