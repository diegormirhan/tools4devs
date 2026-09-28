!macro RetargetMigratedShortcut folder name
  !insertmacro IsShortcutTarget "${folder}\${name}.lnk" "$LegacyInstallDir\$LegacyMainBinaryName"
  Pop $0
  ${If} $0 = 1
    !insertmacro SetShortcutTarget "${folder}\${name}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    !if "${name}" != "${PRODUCTNAME}"
      Rename "${folder}\${name}.lnk" "${folder}\${PRODUCTNAME}.lnk"
    !endif
    !insertmacro SetLnkAppUserModelId "${folder}\${PRODUCTNAME}.lnk"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ${If} $LegacyInstallDir != ""
    ${If} $INSTDIR != $LegacyInstallDir
      ExecWait '$LegacyUninstallString /S /UPDATE _?=$LegacyInstallDir' $0
      ${If} $0 != 0
        MessageBox MB_ICONSTOP "Could not remove the previous installation. Your saved data has been kept. Run this installer again."
        Abort
      ${EndIf}
    ${EndIf}
    !insertmacro RetargetMigratedShortcut "$SMPROGRAMS" "ToolHaven"
    !insertmacro RetargetMigratedShortcut "$SMPROGRAMS" "tools4devs"
    !insertmacro RetargetMigratedShortcut "$DESKTOP" "ToolHaven"
    !insertmacro RetargetMigratedShortcut "$DESKTOP" "tools4devs"
    DeleteRegKey SHCTX "${LEGACYUNINSTKEY}"
    DeleteRegKey SHCTX "${LEGACYMANUPRODUCTKEY}"
  ${EndIf}
!macroend
