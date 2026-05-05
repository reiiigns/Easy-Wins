import { Router, Request, Response } from "express";
import fs from "fs";
import { execFile } from "child_process";
import { scanProject } from "../services/scanner.js";
import { analyzeProject } from "../services/analyzer.js";
import { writeEasyWinsMetadata } from "../services/easyWinsMetadata.js";
import { detectAnalysisProfile, sanitizeAnalysisProfile } from "../services/analysisProfile.js";

const router = Router();

router.get("/select-folder", (_req: Request, res: Response) => {
  if (process.platform !== "win32") {
    res.status(501).json({ error: "Folder picker is only supported on Windows." });
    return;
  }

  const command = String.raw`Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7")]
class FileOpenDialog {}

[ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IFileOpenDialog {
  [PreserveSig] int Show(IntPtr parent);
  void SetFileTypes(uint cFileTypes, IntPtr rgFilterSpec);
  void SetFileTypeIndex(uint iFileType);
  void GetFileTypeIndex(out uint piFileType);
  void Advise(IntPtr pfde, out uint pdwCookie);
  void Unadvise(uint dwCookie);
  void SetOptions(uint fos);
  void GetOptions(out uint pfos);
  void SetDefaultFolder(IShellItem psi);
  void SetFolder(IShellItem psi);
  void GetFolder(out IShellItem ppsi);
  void GetCurrentSelection(out IShellItem ppsi);
  void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string pszName);
  void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string pszName);
  void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string pszTitle);
  void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string pszText);
  void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string pszLabel);
  void GetResult(out IShellItem ppsi);
  void AddPlace(IShellItem psi, int fdap);
  void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string pszDefaultExtension);
  void Close(int hr);
  void SetClientGuid(ref Guid guid);
  void ClearClientData();
  void SetFilter(IntPtr pFilter);
  void GetResults(out IntPtr ppenum);
  void GetSelectedItems(out IntPtr ppsai);
}

[ComImport, Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IShellItem {
  void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
  void GetParent(out IShellItem ppsi);
  void GetDisplayName(uint sigdnName, out IntPtr ppszName);
  void GetAttributes(uint sfgaoMask, out uint psfgaoAttribs);
  void Compare(IShellItem psi, uint hint, out int piOrder);
}

public class FolderPicker {
  public static string Pick() {
    IFileOpenDialog dialog = (IFileOpenDialog)new FileOpenDialog();
    uint options;
    dialog.GetOptions(out options);
    dialog.SetOptions(options | 0x00000020 | 0x00000800 | 0x02000000);
    dialog.SetTitle("Select a project folder to analyze");
    dialog.SetOkButtonLabel("Select Folder");
    int hr = dialog.Show(IntPtr.Zero);
    if (hr == unchecked((int)0x800704C7)) return null;
    if (hr != 0) Marshal.ThrowExceptionForHR(hr);
    IShellItem item;
    dialog.GetResult(out item);
    IntPtr pathPtr;
    item.GetDisplayName(0x80058000, out pathPtr);
    string path = Marshal.PtrToStringUni(pathPtr);
    Marshal.FreeCoTaskMem(pathPtr);
    return path;
  }
}
"@
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$path = [FolderPicker]::Pick()
if ($path) { Write-Output $path }`;

  execFile(
    "powershell.exe",
    ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", command],
    { windowsHide: false, timeout: 120000 },
    (err, stdout, stderr) => {
      if (err) {
        const message = stderr.trim() || err.message || "Folder picker failed";
        res.status(500).json({ error: message });
        return;
      }

      const projectPath = stdout.trim();
      res.json({ projectPath: projectPath.length > 0 ? projectPath : null });
    }
  );
});

router.post("/analyze", async (req: Request, res: Response) => {
  const { projectPath, analysisProfile: rawAnalysisProfile } = req.body;

  // Validation
  if (!projectPath || typeof projectPath !== "string") {
    res.status(400).json({ error: "projectPath is required and must be a string" });
    return;
  }

  if (projectPath.trim().length === 0) {
    res.status(400).json({ error: "projectPath cannot be empty" });
    return;
  }

  // Check path exists
  if (!fs.existsSync(projectPath)) {
    res.status(400).json({ error: `Path does not exist: ${projectPath}` });
    return;
  }

  // Check it's a directory
  const stat = fs.statSync(projectPath);
  if (!stat.isDirectory()) {
    res.status(400).json({ error: `Path is not a directory: ${projectPath}` });
    return;
  }

  try {
    const analysisProfile = sanitizeAnalysisProfile(rawAnalysisProfile);
    // Step 1: Scan the project
    console.log(`[Scanner] Scanning project: ${projectPath}`);
    const scanSummary = await scanProject(projectPath, analysisProfile);
    console.log(`[Scanner] Found ${scanSummary.fileCount} files, ${scanSummary.srcFiles.length} source files`);

    // Step 2: Analyze
    console.log(`[Analyzer] Analyzing project...`);
    const report = await analyzeProject(scanSummary);
    console.log(`[Analyzer] Analysis complete. Overall score: ${report.scores.overall}%`);

    // Step 3: Persist agent workflow metadata
    await writeEasyWinsMetadata(scanSummary.projectPath, report, scanSummary);

    res.json(report);
  } catch (err) {
    console.error("[Analyze Error]", err);
    const message = err instanceof Error ? err.message : "An unexpected error occurred during analysis";
    res.status(500).json({ error: message });
  }
});

router.post("/detect-profile", async (req: Request, res: Response) => {
  const { projectPath } = req.body;

  if (!projectPath || typeof projectPath !== "string" || projectPath.trim().length === 0) {
    res.status(400).json({ error: "projectPath is required and must be a string" });
    return;
  }

  if (!fs.existsSync(projectPath)) {
    res.status(400).json({ error: `Path does not exist: ${projectPath}` });
    return;
  }

  const stat = fs.statSync(projectPath);
  if (!stat.isDirectory()) {
    res.status(400).json({ error: `Path is not a directory: ${projectPath}` });
    return;
  }

  try {
    const scanSummary = await scanProject(projectPath);
    res.json(detectAnalysisProfile(scanSummary));
  } catch (err) {
    console.error("[Detect Profile Error]", err);
    const message = err instanceof Error ? err.message : "An unexpected error occurred during profile detection";
    res.status(500).json({ error: message });
  }
});

export default router;
