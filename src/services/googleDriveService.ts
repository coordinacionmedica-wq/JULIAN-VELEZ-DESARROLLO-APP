
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Service to interact with Google Drive and Google Sheets APIs
 * using the access token obtained during login.
 */
export class GoogleDriveService {
  /**
   * Helper to fetch the root folder ID from settings.
   */
  static async getRootFolderId(): Promise<string> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'driveConfig'));
      if (snap.exists() && snap.data().folderId) {
        return snap.data().folderId;
      }
    } catch(err) {
      console.warn("Could not fetch drive config", err);
    }
    return '1eQ6ZQV0I3rpC5lWsQvWlrHZ4AclKNF2C'; // Fallback
  }

  private static getAccessToken() {
    return localStorage.getItem('google_access_token');
  }

  private static async fetchWithAuth(url: string, options: RequestInit = {}) {
    const token = this.getAccessToken();
    if (!token) throw new Error('No se encontró el token de acceso de Google. Por favor, inicie sesión de nuevo.');

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      throw new Error('La sesión de Google ha expirado o el token es inválido. Por favor, cierre sesión y vuelva a iniciarla.');
    }
    
    if (response.status === 403) {
      throw new Error('Permisos insuficientes en Drive. Por favor, cierre sesión en la app, vuelva a conectarse con Google y conceda todos los permisos solicitados.');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Error en la comunicación con Google API');
    }

    return response.json();
  }

  /**
   * Helper to find a file or folder by name and parent.
   */
  private static async findByName(name: string, parentId: string, mimeType?: string): Promise<string | null> {
    const mimeQuery = mimeType ? ` and mimeType='${mimeType}'` : '';
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${name}' and '${parentId}' in parents${mimeQuery} and trashed=false&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    const searchResult = await this.fetchWithAuth(searchUrl);
    if (searchResult.files && searchResult.files.length > 0) {
      return searchResult.files[0].id;
    }
    return null;
  }

  /**
   * Helper to create a folder.
   */
  private static async createFolder(name: string, parentId: string): Promise<string> {
    const createUrl = 'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true';
    const body = {
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    };
    const newFolder = await this.fetchWithAuth(createUrl, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return newFolder.id;
  }

  /**
   * Finds or creates a folder structure: censos -> Year -> Month.
   * Returns the Month folder ID.
   */
  static async getOrCreateMonthFolder(year: string, month: string): Promise<string> {
    const rootFolderId = await this.getRootFolderId();
    
    // 1. Find or create Year folder
    let yearFolderId = await this.findByName(year, rootFolderId, 'application/vnd.google-apps.folder');
    if (!yearFolderId) {
      yearFolderId = await this.createFolder(year, rootFolderId);
    }

    // 2. Find or create Month folder in Year folder
    let monthFolderId = await this.findByName(month, yearFolderId, 'application/vnd.google-apps.folder');
    if (!monthFolderId) {
      monthFolderId = await this.createFolder(month, yearFolderId);
    }

    return monthFolderId;
  }

  /**
   * Creates a new Google Sheet or gets an existing one by name in the specific month folder.
   */
  static async findOrCreateSheet(fileName: string, parentFolderId?: string): Promise<string> {
    let folderId = parentFolderId;
    if (!folderId) folderId = await this.getRootFolderId();
    
    // 1. Search for existing file in the folder
    const existingId = await this.findByName(fileName, folderId, 'application/vnd.google-apps.spreadsheet');
    if (existingId) return existingId;

    // 2. Create new spreadsheet in the folder using Drive API
    const createUrl = 'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true';
    const body = {
      name: fileName,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderId]
    };
    
    const newSheet = await this.fetchWithAuth(createUrl, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    return newSheet.id;
  }

  /**
   * Helper to query files with advanced search
   */
  private static async queryFiles(query: string): Promise<any[]> {
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=modifiedTime desc&pageSize=50&fields=files(id, name, webViewLink, createdTime, modifiedTime)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    const searchResult = await this.fetchWithAuth(searchUrl);
    return searchResult.files || [];
  }

  /**
   * Lists files in a specific folder.
   */
  static async listFilesInFolder(folderId: string): Promise<{ id: string, name: string, webViewLink: string, createdTime?: string }[]> {
    return this.queryFiles(`'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
  }

  /**
   * Finds a subfolder by name.
   */
  static async findSubfolder(name: string, parentId: string): Promise<string | null> {
    return this.findByName(name, parentId, 'application/vnd.google-apps.folder');
  }

  /**
   * Find month folder by year and month
   */
  static async findMonthFolder(year: string, month: string): Promise<string | null> {
    const rootFolderId = await this.getRootFolderId();
    const yearFolderId = await this.findSubfolder(year, rootFolderId);
    if (!yearFolderId) return null;
    return this.findSubfolder(month, yearFolderId);
  }

  static async updateSheetValues(spreadsheetId: string, range: string, values: any[][]) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`;
    await this.fetchWithAuth(url, {
      method: 'PUT',
      body: JSON.stringify({ values })
    });
  }

  /**
   * Reads values from a spreadsheet
   */
  static async getSheetValues(spreadsheetId: string, range: string): Promise<any[][]> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
    const result = await this.fetchWithAuth(url);
    return result.values || [];
  }

  /**
   * Lists the most recent files inside the base folder structure.
   */
  static async listRecentCensusFiles(): Promise<{ id: string, name: string, webViewLink: string }[]> {
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&orderBy=createdTime desc&pageSize=20&fields=files(id, name, webViewLink)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    const searchResult = await this.fetchWithAuth(searchUrl);
    
    return searchResult.files ? searchResult.files.filter((f: any) => f.name.toUpperCase().startsWith('CENSO_') || f.name.startsWith('ENTREGA_')) : [];
  }
}
