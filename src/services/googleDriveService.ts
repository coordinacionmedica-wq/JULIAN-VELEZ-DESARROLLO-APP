
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

  static async getFileMetadata(fileId: string): Promise<any> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,webViewLink,parents&supportsAllDrives=true`;
    return this.fetchWithAuth(url);
  }

  /**
   * Retrieves the latest Google Doc census file of the day/recent from Google Drive
   */
  static async getLatestCensusGoogleDoc(): Promise<{ id: string; name: string; webViewLink: string; mimeType: string; modifiedTime?: string } | null> {
    try {
      const rootFolderId = await this.getRootFolderId();
      
      // Look for files under the root folder with mimeType of Google Docs, or Word Docx
      const query = `(mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document') and '${rootFolderId}' in parents and trashed=false`;
      const files = await this.queryFiles(query);
      
      if (files && files.length > 0) {
        // Sort files by modifiedTime or createdTime descending
        const sorted = files.sort((a, b) => {
          const tA = new Date(a.modifiedTime || a.createdTime || 0).getTime();
          const tB = new Date(b.modifiedTime || b.createdTime || 0).getTime();
          return tB - tA;
        });
        return sorted[0];
      }

      // Fallback search: search globally for files with 'Censo' or 'Entrega' in name
      const fallbackQuery = `(mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document') and (name contains 'Censo' or name contains 'CENSO' or name contains 'Entrega' or name contains 'ENTREGA') and trashed=false`;
      const fallbackFiles = await this.queryFiles(fallbackQuery);
      if (fallbackFiles && fallbackFiles.length > 0) {
        const sorted = fallbackFiles.sort((a, b) => {
          const tA = new Date(a.modifiedTime || a.createdTime || 0).getTime();
          const tB = new Date(b.modifiedTime || b.createdTime || 0).getTime();
          return tB - tA;
        });
        return sorted[0];
      }
    } catch (e: any) {
      if (e.message?.includes('La sesión de Google ha expirado') || e.message?.includes('token') || e.message?.includes('expired') || e.message?.includes('401')) {
        console.warn("Error fetching latest census file from Google Drive:", e.message);
      } else {
        console.error("Error fetching latest census file from Google Drive:", e);
      }
      throw e;
    }
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
  /**
   * Finds or creates a folder structure: censos -> Year -> Month.
   * Returns the Month folder ID.
   */
  static async getOrCreateMonthFolder(year: string, month: string): Promise<string> {
    const rootFolderId = await this.getRootFolderId();
    
    // 1. Year
    let yearFolderId = await this.findByName(year, rootFolderId, 'application/vnd.google-apps.folder');
    if (!yearFolderId) yearFolderId = await this.createFolder(year, rootFolderId);

    // 2. Month
    let monthFolderId = await this.findByName(month, yearFolderId, 'application/vnd.google-apps.folder');
    if (!monthFolderId) monthFolderId = await this.createFolder(month, yearFolderId);

    return monthFolderId;
  }

  static async getOrCreateDayJornadaFolder(year: string, month: string, day: string, jornada: string): Promise<string> {
    const rootFolderId = await this.getRootFolderId();
    
    // 1. Year
    let yearFolderId = await this.findByName(year, rootFolderId, 'application/vnd.google-apps.folder');
    if (!yearFolderId) yearFolderId = await this.createFolder(year, rootFolderId);

    // 2. Month
    let monthFolderId = await this.findByName(month, yearFolderId, 'application/vnd.google-apps.folder');
    if (!monthFolderId) monthFolderId = await this.createFolder(month, yearFolderId);

    // 3. Day
    let dayFolderId = await this.findByName(day, monthFolderId, 'application/vnd.google-apps.folder');
    if (!dayFolderId) dayFolderId = await this.createFolder(day, monthFolderId);

    // 4. Jornada (Mañana, Tarde, Noche)
    let jornadaFolderId = await this.findByName(jornada, dayFolderId, 'application/vnd.google-apps.folder');
    if (!jornadaFolderId) jornadaFolderId = await this.createFolder(jornada, dayFolderId);

    return jornadaFolderId;
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
   * Creates a new Google Doc or gets an existing one by name in the specific folder.
   */
  static async findOrCreateGoogleDoc(fileName: string, parentFolderId?: string): Promise<string> {
    let folderId = parentFolderId;
    if (!folderId) folderId = await this.getRootFolderId();
    
    // 1. Search for existing Google Doc in the folder
    const existingId = await this.findByName(fileName, folderId, 'application/vnd.google-apps.document');
    if (existingId) return existingId;

    // 2. Create new Google Doc in the folder using Drive API
    const createUrl = 'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true';
    const body = {
      name: fileName,
      mimeType: 'application/vnd.google-apps.document',
      parents: [folderId]
    };
    
    const newDoc = await this.fetchWithAuth(createUrl, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    return newDoc.id;
  }

  /**
   * Updates the exact text content of a Google Doc using the Google Docs BatchUpdate API.
   * This replaces the entire text body cleanly.
   */
  static async updateGoogleDocText(fileId: string, text: string): Promise<void> {
    const token = this.getAccessToken();
    if (!token) throw new Error('No se encontró el token de acceso de Google. Inicie sesión de nuevo.');

    // 1. Query the document structure to find previous body size/end index
    const getUrl = `https://docs.googleapis.com/v1/documents/${fileId}`;
    const docMeta = await this.fetchWithAuth(getUrl, {
      method: 'GET'
    });

    const bodyContent = docMeta.body?.content || [];
    let lastIndex = 1;
    if (bodyContent.length > 0) {
      lastIndex = bodyContent[bodyContent.length - 1].endIndex - 1;
    }

    // 2. Send batch update post to replace
    const updateUrl = `https://docs.googleapis.com/v1/documents/${fileId}:batchUpdate`;
    const requests: any[] = [];
    
    if (lastIndex > 1) {
      requests.push({
        deleteContentRange: {
          range: {
            startIndex: 1,
            endIndex: lastIndex
          }
        }
      });
    }

    requests.push({
      insertText: {
        text: text,
        location: {
          index: 1
        }
      }
    });

    await this.fetchWithAuth(updateUrl, {
      method: 'POST',
      body: JSON.stringify({ requests })
    });
  }
  private static async queryFiles(query: string): Promise<any[]> {
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=modifiedTime desc&pageSize=100&fields=files(id, name, webViewLink, createdTime, modifiedTime, mimeType, parents)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    const searchResult = await this.fetchWithAuth(searchUrl);
    return searchResult.files || [];
  }

  static async getGoogleDocText(fileId: string): Promise<string> {
    const token = this.getAccessToken();
    if (!token) throw new Error('No se encontró el token de acceso de Google. Por favor, inicie sesión de nuevo.');
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) {
      throw new Error(`No se pudo exportar el documento de Google: ${response.statusText}`);
    }
    return response.text();
  }

  static async convertWordToGoogleDoc(fileId: string, name: string): Promise<string> {
    const token = this.getAccessToken();
    if (!token) throw new Error('No se encontró el token de acceso de Google. Por favor, inicie sesión de nuevo.');
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}/copy?supportsAllDrives=true`;
    const body = {
      name: `${name} (Converted Temp)`,
      mimeType: 'application/vnd.google-apps.document'
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`No se pudo copiar/convertir el archivo Word: ${errText}`);
    }
    const result = await response.json();
    return result.id;
  }

  static async deleteFile(fileId: string): Promise<void> {
    const token = this.getAccessToken();
    if (!token) return;
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`;
    await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  /**
   * Lists files in a specific folder.
   */
  static async listFilesInFolder(folderId: string): Promise<{ id: string, name: string, webViewLink: string, createdTime?: string, mimeType?: string }[]> {
    return this.queryFiles(`'${folderId}' in parents and trashed=false`);
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
    const resolvedRange = await this.resolveSheetRange(spreadsheetId, range);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${resolvedRange}?valueInputOption=RAW`;
    await this.fetchWithAuth(url, {
      method: 'PUT',
      body: JSON.stringify({ values })
    });
  }

  /**
   * Reads values from a spreadsheet
   */
  static async getSheetValues(spreadsheetId: string, range: string): Promise<any[][]> {
    const resolvedRange = await this.resolveSheetRange(spreadsheetId, range);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${resolvedRange}`;
    const result = await this.fetchWithAuth(url);
    return result.values || [];
  }

  /**
   * Resolves Sheet1 range to match the actual first sheet name of the spreadsheet
   */
  private static async resolveSheetRange(spreadsheetId: string, range: string): Promise<string> {
    if (!range.startsWith('Sheet1!')) {
      return range;
    }
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
      const docMeta = await this.fetchWithAuth(url);
      const sheets = docMeta.sheets;
      if (sheets && sheets.length > 0) {
        const firstSheetName = sheets[0].properties.title;
        if (firstSheetName && firstSheetName !== 'Sheet1') {
          return range.replace('Sheet1!', `${firstSheetName}!`);
        }
      }
    } catch (err) {
      console.warn("Failed to resolve spreadsheet sheet name dynamically, relying on original range:", err);
    }
    return range;
  }

  /**
   * Recursively fetches all files inside a folder (including nested subfolders).
   */
  static async getFilesInsideFolderRecursive(folderId: string): Promise<{ id: string, name: string, webViewLink: string, createdTime?: string, mimeType?: string, parents?: string[] }[]> {
    try {
      const listUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and trashed=false&fields=files(id, name, webViewLink, createdTime, modifiedTime, mimeType, parents)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
      const result = await this.fetchWithAuth(listUrl);
      const files = result.files || [];
      
      let allFiles: any[] = [];
      for (const f of files) {
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          try {
            const subFiles = await this.getFilesInsideFolderRecursive(f.id);
            allFiles = [...allFiles, ...subFiles];
          } catch (e) {
            console.warn(`Error reading subfolder ${f.name}:`, e);
          }
        } else {
          allFiles.push(f);
        }
      }
      return allFiles;
    } catch (err) {
      console.error("Error in getFilesInsideFolderRecursive:", err);
      return [];
    }
  }

  static async listMonthCensusFiles(year: string, monthPrefix: string): Promise<{ id: string, name: string, webViewLink: string, createdTime?: string, mimeType?: string }[]> {
    try {
      const monthNames = [
        'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
      ];
      const monthIndex = parseInt(monthPrefix, 10) - 1;
      const monthNameEs = monthNames[monthIndex];
      const monthFolderName = `${monthPrefix} - ${monthNameEs}`;
      
      const rootFolderId = await this.getRootFolderId();
      
      // 1. Fetch Month Folder files (if folder can be found or created)
      let monthFiles: any[] = [];
      let monthFolderId: string | null = null;
      try {
        monthFolderId = await this.getOrCreateMonthFolder(year, monthFolderName);
        if (monthFolderId) {
          monthFiles = await this.getFilesInsideFolderRecursive(monthFolderId);
        }
      } catch (x) {
        console.warn("Could not load nested month folder files:", x);
      }
      
      // 2. Fetch Root Direct files
      let rootFiles: any[] = [];
      try {
        rootFiles = await this.listFilesInFolder(rootFolderId);
      } catch (x) {
        console.warn("Could not load direct root files:", x);
      }
      
      // Combine files and de-duplicate by ID
      const allFiles = [...monthFiles, ...rootFiles];
      const seenIds = new Set<string>();
      
      const filtered = allFiles.filter((f: any) => {
        if (seenIds.has(f.id)) return false;
        seenIds.add(f.id);
        
        // Match mimeTypes corresponding to docs/or spreadsheets
        const isDocOrSheet = 
          f.mimeType === 'application/vnd.google-apps.document' ||
          f.mimeType === 'application/vnd.google-apps.spreadsheet' ||
          f.mimeType?.includes('wordprocessingml') ||
          f.mimeType?.includes('spreadsheetml');
          
        if (!isDocOrSheet) return false;
        
        // If file is from the root folder directly, check if its name or date fits the context of selected year/month
        const isFromMonthFolder = monthFolderId && f.parents?.includes(monthFolderId);
        if (!isFromMonthFolder) {
          const lowerName = f.name.toLowerCase();
          const monthShort = monthNameEs.substring(0, 3).toLowerCase();
          
          const matchesYear = lowerName.includes(year);
          const matchesMonth = lowerName.includes(monthPrefix) || lowerName.includes(monthNameEs.toLowerCase()) || lowerName.includes(monthShort);
          
          // Also check created/modified timestamps
          const fileDate = new Date(f.createdTime || f.modifiedTime || Date.now());
          const matchesDate = fileDate.getFullYear().toString() === year && (fileDate.getMonth() + 1).toString().padStart(2, '0') === monthPrefix;
          
          return matchesYear || matchesMonth || matchesDate;
        }
        
        return true;
      });

      return filtered.sort((a: any, b: any) => {
        const timeA = new Date(a.createdTime || a.modifiedTime || 0).getTime();
        const timeB = new Date(b.createdTime || b.modifiedTime || 0).getTime();
        return timeB - timeA;
      });
    } catch(err) {
      console.error("Error listing month files:", err);
      // Fallback search matching any docs or spreadsheets
      const query = `(mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document') and trashed=false`;
      return this.queryFiles(query);
    }
  }

  /**
   * Lists the most recent files inside the base folder structure.
   */
  static async listRecentCensusFiles(): Promise<{ id: string, name: string, webViewLink: string, mimeType?: string }[]> {
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=(mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.document') and trashed=false&orderBy=createdTime desc&pageSize=20&fields=files(id, name, webViewLink, mimeType)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    const searchResult = await this.fetchWithAuth(searchUrl);
    
    return searchResult.files ? searchResult.files.filter((f: any) => f.name.toUpperCase().startsWith('CENSO_') || f.name.startsWith('ENTREGA_')) : [];
  }
}
