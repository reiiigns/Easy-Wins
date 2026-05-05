import axios from "axios";
import type { AnalysisProfile, ProjectReport } from "../types/report";

type ElectronAPI = {
  openProjectFolder?: () => Promise<string | null>;
};

const api = axios.create({
  baseURL: window.location.protocol === "file:" ? "http://localhost:3001/api" : "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export async function analyzeProject(projectPath: string, analysisProfile?: AnalysisProfile): Promise<ProjectReport> {
  const response = await api.post<ProjectReport>("/analyze", { projectPath, analysisProfile });
  return response.data;
}

export async function detectAnalysisProfile(projectPath: string): Promise<AnalysisProfile> {
  const response = await api.post<AnalysisProfile>("/detect-profile", { projectPath });
  return response.data;
}

export async function selectProjectFolder(): Promise<string | null> {
  const electronAPI = (window as { electronAPI?: ElectronAPI }).electronAPI;
  if (electronAPI?.openProjectFolder) {
    return electronAPI.openProjectFolder();
  }

  const response = await api.get<{ projectPath: string | null }>("/select-folder");
  return response.data.projectPath;
}

export default api;
