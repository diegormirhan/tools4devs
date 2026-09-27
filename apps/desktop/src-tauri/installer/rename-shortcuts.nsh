; Update only shortcuts owned by the previous installation, preserving custom links.
!macro RenameLegacyShortcut folder
  !insertmacro IsShortcutTarget "${folder}\ToolHaven.lnk" "$INSTDIR\$OldMainBinaryName"
  Pop $0
  ${If} $0 = 1
    !insertmacro SetShortcutTarget "${folder}\ToolHaven.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    Rename "${folder}\ToolHaven.lnk" "${folder}\${PRODUCTNAME}.lnk"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro RenameLegacyShortcut "$SMPROGRAMS"
  !insertmacro RenameLegacyShortcut "$DESKTOP"
!macroend
