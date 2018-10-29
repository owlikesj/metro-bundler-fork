/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * 
 */

'use strict';
var _extends = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];
    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }
  return target;
};

const Server = require('../../Server');

const meta = require('./meta');
const relativizeSourceMap = require('../../lib/relativizeSourceMap');
const writeFile = require('./writeFile');
const fs = require('fs');
const denodeify = require('denodeify');



function buildBundle(packagerClient, requestOptions) {
  return packagerClient.buildBundle(_extends({},
    Server.DEFAULT_BUNDLE_OPTIONS,
    requestOptions, {
      isolateModuleIDs: true
    }));

}

function createCodeWithMap(
  bundle,
  dev,
  sourceMapSourcesRoot) {
  const map = bundle.getSourceMap({
    dev
  });
  const sourceMap = relativizeSourceMap(
    typeof map === 'string' ? JSON.parse(map) : map,
    sourceMapSourcesRoot);
  return {
    code: bundle.getSource({
      dev
    }),
    map: sourceMap
  };

}

function createModuleManifest(bundle) {
  const modules = bundle.getModules();

  return modules.map(m => m.id);
}

function removeModules(bundle, path) {
  const fileStr = fs.readFileSync(path);
  const modules = bundle.getModules();
  const filterList = JSON.parse(fileStr);
  let filterMap = {}
  filterList.forEach(m => {
    filterMap[m] = true
  });
  bundle.__modules = bundle.__modules.filter(m => {
    if (m.id === -1) {
      return false;
    };
    if (m.id === -2) {
      return true;
    };
    return !filterMap[m.id]
  })

}

function getPageIds(bundle, moduleName) {
  let ids = {};
  const reg = /getConfig.+\{id:['"](\d+)['"]/;
  const bundles = bundle.getModules();
  for (let index = 0; index < bundles.length; index++) {
    const component = bundles[index];
    if (/^View.+js$/.test(component.id)) {
      reg.exec(component.code)
      if (RegExp.$1) {
        ids[(RegExp.$1).toString()] = moduleName;
      }
    }
  }

  return ids;
}

function saveBundleAndMap(
  bundle,
  options,
  log) {
  const

    bundleOutput = options.bundleOutput,
    encoding = options.bundleEncoding,
    dev = options.dev,
    sourcemapOutput = options.sourcemapOutput,
    sourcemapSourcesRoot = options.sourcemapSourcesRoot;

  log('start');
  if (options.excludeCommonFiles) {
    let files = options.excludeCommonFiles.split(',');
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      removeModules(bundle, 'dest/' + file + '_manifest.json');
    }
  }

  let ids = getPageIds(bundle, bundleOutput);
  const origCodeWithMap = createCodeWithMap(bundle, !!dev, sourcemapSourcesRoot);
  const codeWithMap = bundle.postProcessBundleSourcemap(_extends({},
    origCodeWithMap, {
      outFileName: bundleOutput
    }));

  log('finish');

  log('Writing bundle output to:', bundleOutput);
  const code = codeWithMap.code;
  if (!fs.existsSync('dest')) {
    fs.mkdirSync('dest')
  }
  if (!fs.existsSync('dest/' + bundleOutput)) {
    fs.mkdirSync('dest/' + bundleOutput)
  }

  let destDir = 'dest/' + bundleOutput;

  const writeBundle = writeFile(destDir + '/index.js', code, encoding);
  const writeMap = writeFile(destDir + '/map.json', JSON.stringify(ids), encoding)
  const manifest = createModuleManifest(bundle);
  const writeManifest = writeFile('dest/' + bundleOutput + "_manifest.json", JSON.stringify(manifest), encoding);
  Promise.all([writeBundle, writeManifest, writeMap]).
    then(() => log('Done writing bundle output'));

  if (sourcemapOutput) {
    log('Writing sourcemap output to:', sourcemapOutput);
    const map = typeof codeWithMap.map !== 'string' ?
      JSON.stringify(codeWithMap.map) :
      codeWithMap.map;
    const writeMap = writeFile(sourcemapOutput, map, null);
    writeMap.then(() => log('Done writing sourcemap output'));
    return Promise.all([writeBundle, writeMetadata, writeMap]);
  } else {
    return writeBundle;
  }
}

exports.build = buildBundle;
exports.save = saveBundleAndMap;
exports.formatName = 'bundle';