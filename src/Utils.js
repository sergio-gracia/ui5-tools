import { workspace } from 'vscode';
import path from 'path';
import fs from 'fs';

let config = {};

function getConfiguration(tool = '') {
  if (tool) {
    tool = '.' + tool;
  }
  return workspace.getConfiguration('ui5-tools' + tool);
}

function getConfigurationProperty(property, tool = '') {
  if (property) {
    return getConfiguration(tool).get(property);
  }
  return getConfiguration(tool);
}

function getConfigurationGeneral(property) {
  return getConfigurationProperty(property);
}

function getConfigurationServer(property) {
  return getConfigurationProperty(property, 'server');
}
function getConfigurationBuilder(property) {
  return getConfigurationProperty(property, 'builder');
}

function getRoot() {
  let baseDir = workspace.rootPath;
  if (baseDir) {
    let doSplit = true;
    if (workspace.workspaceFolders.length == 1) {
      var p = workspace.workspaceFolders[0].uri.path;
      if (p === baseDir) {
        doSplit = false;
      }
    }
    if (doSplit) {
      let arr = baseDir.split('/');
      arr.pop();
      baseDir = arr.join('/');
    }
  }
  return baseDir;
}

function loadConfig(restarting = false) {
  let srcFolder = getConfigurationGeneral('srcFolder');
  let distFolder = getConfigurationGeneral('distFolder');
  let ui5Version = getConfigurationGeneral('ui5Version');

  let serverName = getConfigurationServer('name');
  let port = getConfigurationServer('port');
  let openBrowser = getConfigurationServer('openBrowser');
  let watch = getConfigurationServer('watch');
  let watchExtensions = getConfigurationServer('watchExtensions');
  let gatewayProxy = getConfigurationServer('gatewayProxy');
  let gatewayUri = getConfigurationServer('gatewayUri');
  let resourcesProxy = getConfigurationServer('resourcesProxy');
  let localDependencies = getConfigurationServer('localDependencies');
  let serveFolder = getConfigurationServer('serveFolder');
  let protocol = getConfigurationServer('protocol');
  let index = 'index.html';

  let debugSources = getConfigurationBuilder('debugSources');
  let uglifySources = getConfigurationBuilder('uglifySources');
  let portLiveReload = 35729;
  let lrPath = __non_webpack_require__.resolve('../scripts/livereload');

  let ui5ToolsPath = lrPath.slice(0, lrPath.indexOf('scripts'));
  let cert = {
    key: fs.readFileSync(path.join(ui5ToolsPath, 'cert', 'server.key')),
    cert: fs.readFileSync(path.join(ui5ToolsPath, 'cert', 'server.cert')),
  };

  let open = restarting ? false : openBrowser;

  let baseDir = getRoot();

  let files = [];
  let serveStatic = [];
  let routes = {};
  let folders = [];
  let foldersRoot = [];
  let foldersRootMap = {};

  let foldersWithName = [];

  let servingFolder = serveFolder === 'Source Folder' ? srcFolder : distFolder;

  if (workspace.workspaceFolders) {
    // Is a workspace

    workspace.workspaceFolders.forEach((route) => {
      checkFolder(route.uri.path, {
        servingFolder,
        foldersWithName,
        route,
        folders,
        files,
        watchExtensions,
        foldersRoot,
        foldersRootMap,
        serveStatic,
        routes,
      });
    });

    if (folders.length == 0) {
      fs.readdirSync(baseDir).forEach((fileOrFolder) => {
        checkFolder(path.join(baseDir, fileOrFolder), {
          servingFolder,
          foldersWithName,
          route: {
            name: fileOrFolder,
            uri: { path: fileOrFolder },
          },
          folders,
          files,
          watchExtensions,
          foldersRoot,
          foldersRootMap,
          serveStatic,
          routes,
        });
      });
    }
  } else {
    throw new Error('Create at least one project in your workspace');
  }

  config = {
    // General Config
    srcFolder,
    distFolder,
    ui5Version,
    // Server config
    cert,
    lrPath,
    serverName,
    port,
    openBrowser,
    watch,
    watchExtensions,
    gatewayProxy,
    gatewayUri,
    resourcesProxy,
    localDependencies,
    serveFolder,
    index,
    protocol,
    // Builder config
    debugSources,
    uglifySources,
    // Modified config
    baseDir,
    foldersRoot,
    foldersRootMap,
    folders,
    foldersWithName,
    files,
    serveStatic,
    routes,
    open,
    portLiveReload,
  };
  return config;
}
function getConfig() {
  return config;
}

function checkFolder(
  folderPath,
  {
    servingFolder,
    foldersWithName,
    route,
    folders,
    files,
    watchExtensions,
    foldersRoot,
    foldersRootMap,
    serveStatic,
    routes,
  }
) {
  let folder, folderUri;
  if (fs.existsSync(path.join(folderPath, servingFolder))) {
    folder = '' + folderPath.split(path.sep).pop();
    foldersWithName.push(route);
    folders.push(folder);

    files.push(path.join(folder, servingFolder, `*.{${watchExtensions}}`));
    files.push(path.join(folder, servingFolder, '**', `*.{${watchExtensions}}`));

    folderUri = '/' + folder;
    routes[folderUri] = path.join(folder, servingFolder);

    foldersRoot.push(path.join(folderPath, servingFolder));
    foldersRootMap[folderUri] = path.join(folderPath, servingFolder);

    serveStatic.push({
      route: folder,
      dir: path.join(folderPath, servingFolder),
    });
  }
}
function getIndex({ serverName, foldersRootMap }) {
  let apps = '',
    appName;

  Object.entries(foldersRootMap).forEach(([key, folderRoot]) => {
    appName = key.replace('/', '');
    apps += `
      <div class="col-sm-6 col-md-4 col-lg-3">
        <div class="card bg-light mb-3">
          <div class="card-body"><a href="${key}">${appName}</a></div>
        </div>
      </div>
    `;
  });

  let indexPage = `
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <link
          rel="stylesheet"
          href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css"
          integrity="sha384-9aIt2nRpC12Uk9gS9baDl411NQApFmC26EwAOH8WgZl5MYYxFfc+NcPb1dKGj7Sk"
          crossorigin="anonymous"
        />
        <title>${serverName}</title>
        <style>
          li {
            padding: 0.5rem;
            background-color: antiquewhite;
            margin: 0.25rem;
          }
          li a {
          }
        </style>
      </head>
      <body class="d-flex flex-column h-100">
        <header>
          <nav class="navbar navbar-light bg-light">
            <a class="navbar-brand mb-0 h1" href="#">${serverName} | Workspace</a>
          </nav>
        </header>
        <main role="main" class="flex-shrink-0">
          <div class="container">
            <h1 class="mt-3">Apps List</h1>

            <div class="row">
              ${apps}
            </div>
          </div>
        </main>
        <footer class="footer mt-auto py-3">
          <div class="container">
            <span class="text-muted">
              ui5-tools | <a href="https://github.com/CarlosOrozco88/ui5-tools">GitHub</a> |
              <a href="https://github.com/CarlosOrozco88/ui5-tools/issues">Issues</a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  `;

  return indexPage;
}

export default {
  getConfigurationGeneral,
  getConfigurationServer,
  getConfigurationBuilder,
  getRoot,
  loadConfig,
  getConfig,
  getIndex,
};
