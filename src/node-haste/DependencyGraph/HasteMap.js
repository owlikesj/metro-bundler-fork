/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * 
 * @format
 */

'use strict';

const EventEmitter = require('events');

const parsePlatformFilePath = require('../lib/parsePlatformFilePath');
const path = require('path');
const throat = require('throat');

const GENERIC_PLATFORM = 'generic';
const NATIVE_PLATFORM = 'native';
const PACKAGE_JSON = path.sep + 'package.json';













class HasteMap extends EventEmitter {









  constructor(_ref)






  {let extensions = _ref.extensions,files = _ref.files,helpers = _ref.helpers,moduleCache = _ref.moduleCache,platforms = _ref.platforms,preferNativePlatform = _ref.preferNativePlatform;
    super();
    this._extensions = extensions;
    this._files = files;
    this._helpers = helpers;
    this._moduleCache = moduleCache;
    this._platforms = platforms;
    this._preferNativePlatform = preferNativePlatform;

    this._processHastePackage = throat(
    1,
    this._processHastePackage.bind(this));

    this._processHasteModule = throat(
    1,
    this._processHasteModule.bind(this));

  }

  build() {
    this._map = Object.create(null);
    this._packages = Object.create(null);
    const promises = [];
    this._files.forEach(filePath => {
      if (!this._helpers.isNodeModulesDir(filePath)) {
        if (filePath.endsWith(PACKAGE_JSON)) {
          promises.push(this._processHastePackage(filePath));
        } else if (
        this._extensions.indexOf(path.extname(filePath).substr(1)) !== -1)
        {
          promises.push(this._processHasteModule(filePath));
        }
      }
    });
    return Promise.all(promises).then(() => this._map);
  }

  getAllFiles() {
    return this._files;
  }

  processFileChange(type, absPath) {
    return Promise.resolve().then(() => {
      /*eslint no-labels: 0 */
      let invalidated;
      if (type === 'delete' || type === 'change') {
        loop: for (const name in this._map) {
          const modulesMap = this._map[name];
          for (const platform in modulesMap) {
            const module = modulesMap[platform];
            if (module.path === absPath) {
              delete modulesMap[platform];
              invalidated = name;
              break loop;
            }
          }
        }

        if (type === 'delete') {
          if (invalidated) {
            this.emit('change');
          }
          return null;
        }
      }

      if (
      type !== 'delete' &&
      this._extensions.indexOf(this._helpers.extname(absPath)) !== -1)
      {
        if (path.basename(absPath) === 'package.json') {
          return this._processHastePackage(absPath, invalidated);
        } else {
          return this._processHasteModule(absPath, invalidated);
        }
      }
      return null;
    });
  }

  getModule(name, platform) {
    const modulesMap = this._map[name];
    if (modulesMap == null) {
      return null;
    }

    // If platform is 'ios', we prefer .ios.js to .native.js which we prefer to
    // a plain .js file.
    let module;
    if (module == null && platform != null) {
      module = modulesMap[platform];
    }
    if (module == null && this._preferNativePlatform) {
      module = modulesMap[NATIVE_PLATFORM];
    }
    if (module == null) {
      module = modulesMap[GENERIC_PLATFORM];
    }
    return module;
  }

  getPackage(name) {
    return this._packages[name];
  }

  _processHasteModule(file, previousName) {
    const module = this._moduleCache.getModule(file);
    return Promise.resolve().then(() => {
      const isHaste = module.isHaste();
      return (
        isHaste &&
        module.getName().then(name => {
          const result = this._updateHasteMap(name, module);
          if (previousName && name !== previousName) {
            this.emit('change');
          }
          return result;
        }));

    });
  }

  _processHastePackage(file, previousName) {
    const p = this._moduleCache.getPackage(file);
    return Promise.resolve().
    then(() => {
      const isHaste = p.isHaste();
      return (
        isHaste &&
        p.getName().then(name => {
          const result = this._updateHasteMap(name, p);
          if (previousName && name !== previousName) {
            this.emit('change');
          }
          return result;
        }));

    }).
    catch(e => {
      if (e instanceof SyntaxError) {
        // Malformed package.json.
        return;
      }
      throw e;
    });
  }

  _updateHasteMap(name, mod) {
    let existingModule;

    if (mod.type === 'Package') {
      existingModule = this._packages[name];
      this._packages[name] = mod;
    } else {
      if (this._map[name] == null) {
        this._map[name] = Object.create(null);
      }
      const moduleMap = this._map[name];
      const modulePlatform =
      parsePlatformFilePath(mod.path, this._platforms).platform ||
      GENERIC_PLATFORM;
      existingModule = moduleMap[modulePlatform];
      moduleMap[modulePlatform] = mod;
    }

    if (existingModule && existingModule.path !== mod.path) {
      throw new Error(
      `@providesModule naming collision:\n` +
      `  Duplicate module name: ${name}\n` +
      `  Paths: ${mod.path} collides with ${existingModule.path}\n\n` +
      'This error is caused by a @providesModule declaration ' +
      'with the same name across two different files.');

    }
  }}


module.exports = HasteMap;