# Mirror the acupuncture bank into its private GitHub working copy (D:\acupuncture-bank), then show git status.
#   powershell -File sync-repo.ps1            # copy only
#   powershell -File sync-repo.ps1 -Commit "message"   # copy, commit and push
param([string]$Commit = "")

$repo  = "D:\acupuncture-bank"
$tools = "E:\Documents\Claude\tools\acu-bank"
$bank  = "E:\Documents\Obsidian\TCM Vault\Acupuncture Bank"
$pts   = "E:\Documents\Claude\tcm-learn\data\seed\points\points.csv"

New-Item -ItemType Directory -Force -Path "$repo\tools", "$repo\bank", "$repo\data" | Out-Null
robocopy $tools "$repo\tools" /MIR /XF peek.mjs survey.mjs /XD node_modules /NFL /NDL /NJH /NJS /NP | Out-Null
robocopy "$bank\_data" "$repo\bank\_data" /MIR /XF "*.report.txt" /NFL /NDL /NJH /NJS /NP | Out-Null
Copy-Item "$bank\viewer.html" "$repo\bank\viewer.html" -Force
Copy-Item $pts "$repo\data\points.csv" -Force

Set-Location $repo
git add -A
git status --short | Select-Object -First 15
if ($Commit) {
  git commit -m $Commit -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
  git push
}
