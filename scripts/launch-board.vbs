' Runs launch-board.ps1 with no visible console window.
' The desktop shortcut targets wscript.exe with this file as its argument.
Dim fso, shell, scriptDir
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & scriptDir & "\launch-board.ps1""", 0, False
