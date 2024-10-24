import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import Menu from '../Menu/Menu';
import Finder from '../Project/Finder';
import LiveServer from '../Server/LiveServer';
import Projects from '../Server/Projects';
import StatusBar from '../StatusBar/StatusBar';
import Utils from '../Utils/ExtensionVscode';
import ConfigVscode from '../Utils/ConfigVscode';
import Extension from '../Utils/ExtensionVscode';

let watchApps: FSWatcher | undefined;
const awaiter: Record<string, ReturnType<typeof setTimeout>> = {};

export default {
  awaiter,
  watchApps,

  async close() {
    if (this.watchApps) {
      await this.watchApps.close();
      this.watchApps = undefined;
    }
  },

  async start(): Promise<void> {
    await this.close();

    const sWorkspaceRootPath = path.join(Utils.getWorkspaceRootPath());

    const excludedFiles = await ConfigVscode.getExcludedFiles();
    this.watchApps = chokidar.watch([sWorkspaceRootPath], {
      ignoreInitial: true,
      ignored: (sPath: string) => {
        const sPathResolved = path.resolve(sPath);

        let bIgnore = Extension.excluder(sPath, excludedFiles);

        if (!bIgnore) {
          const ui5Projects = Array.from(Finder.ui5Projects.values());
          const ui5Project = ui5Projects.find(
            (ui5Project) => ui5Project.fsPathBase !== sPathResolved && sPathResolved.startsWith(ui5Project.fsPathBase)
          );
          bIgnore = !!ui5Project;
        }
        return bIgnore;
      },
      usePolling: false,
    });

    this.watchApps.on('add', (sFilePath) => this.fileAdded(sFilePath));
    this.watchApps.on('change', (sFilePath) => this.fileChanged(sFilePath));
    this.watchApps.on('unlink', (sFilePath) => this.fileDeleted(sFilePath));

    this.watchApps.on('unlinkDir', (sFilePath) => this.folderDeleted(sFilePath));
  },

  async fileAdded(sFilePath: string) {
    const sPathResolved = path.resolve(sFilePath);
    if (this.isManifest(sPathResolved)) {
      const ui5Project = await Finder.addUi5Project(sPathResolved);
      if (ui5Project) {
        await Projects.serveProject(ui5Project);
        await StatusBar.checkVisibility(false);

        Menu.setContexts();
        LiveServer.refresh(sPathResolved);
      }
    }
  },

  async fileChanged(sFilePath: string) {
    const sPathResolved = path.resolve(sFilePath);
    if (this.isManifest(sPathResolved)) {
      const ui5Project = await Finder.findUi5ProjectForWorkingFsPath(sPathResolved);
      if (!ui5Project) {
        this.fileAdded(sPathResolved);
      }
    }
  },

  async fileDeleted(sFilePath: string) {
    const sPathResolved = path.resolve(sFilePath);
    if (this.isManifest(sPathResolved)) {
      await Finder.removeUi5ProjectManifest(sPathResolved);
      await StatusBar.checkVisibility(false);
      LiveServer.refresh(sPathResolved);
    }
  },

  async folderDeleted(sFilePath: string) {
    const ui5Project = await Finder.findUi5ProjectForFsPath(sFilePath);
    if (ui5Project && ui5Project.fsPathBase === sFilePath) {
      await Finder.removeUi5Project(ui5Project);

      LiveServer.refresh(sFilePath);
    }
  },

  isManifest(sFilePath: string) {
    const filename = path.basename(sFilePath);
    return filename === 'manifest.json';
  },
};
