import angular from 'angular';
import _ from 'underscore';
import idbKeyval from 'idb-keyval';

angular.module('dimApp')
  .factory('SyncService', SyncService);

function SyncService($q, $translate, dimBungieService, dimState, dimFeatureFlags) {
  var cached; // cached is the data in memory,

  const LocalStorage = {
    get: function() {
      return $q.resolve(JSON.parse(localStorage.getItem('DIM')));
    },

    set: function(value) {
      localStorage.setItem('DIM', JSON.stringify(value));
      return $q.resolve(value);
    },

    // TODO: disable if indexedDB is on
    enabled: true,
    name: 'LocalStorage'
  };

  const IndexedDBStorage = {
    get: function() {
      return idbKeyval.get('DIM-data');
    },

    set: function(value) {
      return idbKeyval.set('DIM-data', value);
    },

    enabled: true,
    name: 'IndexedDBStorage'
  };

  const ChromeSyncStorage = {
    get: function() {
      return new $q((resolve, reject) => {
        chrome.storage.sync.get(null, function(data) {
          if (chrome.runtime.lastError) {
            const message = chrome.runtime.lastError.message;
            reject(new Error(message));
          } else {
            resolve(data);
          }
        });
      });
    },

    set: function(value) {
      return new $q((resolve, reject) => {
        chrome.storage.sync.set(value, () => {
          if (chrome.runtime.lastError) {
            const message = chrome.runtime.lastError.message;
            if (message.indexOf('QUOTA_BYTES_PER_ITEM') > -1) {
              reject(new Error($translate.instant('SyncService.OneItemTooLarge')));
            } else if (message.indexOf('QUOTA_BYTES') > -1) {
              reject(new Error($translate.instant('SyncService.SaveTooLarge')));
            } else {
              reject(new Error(message));
            }
          } else {
            resolve();
          }
        });
      });
    },

    remove: function(key) {
      return $q((resolve, reject) => {
        chrome.storage.sync.remove(key, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError));
          } else {
            resolve();
          }
        });
      });
    },

    enabled: (window.chrome && chrome.storage && chrome.storage.sync),
    name: 'ChromeSyncStorage'
  };

  const GoogleDriveStorage = {
    drive: { // drive api data
      client_id: '22022180893-raop2mu1d7gih97t5da9vj26quqva9dc.apps.googleusercontent.com',
      scope: 'https://www.googleapis.com/auth/drive.appfolder',
      immediate: false
    },
    fileId: null,
    ready: $q.defer(),

    get: function() {
      return this.ready.promise.then(this.authorize.bind(this)).then(() => {
        return new $q((resolve) => {
          gapi.client.load('drive', 'v2', function() {
            gapi.client.drive.files.get({
              fileId: this.fileId,
              alt: 'media'
            }).execute((resp) => {
              if (resp.code === 401 || resp.code === 404) {
                this.revokeDrive();
                return;
              }
              cached = resp;
              resolve(cached);
            });
          });
        });
      });
    },

    // TODO: set a timestamp for merging?
    set: function(value) {
      return new $q((resolve, reject) => {
        gapi.client.request({
          path: '/upload/drive/v2/files/' + this.fileId,
          method: 'PUT',
          params: {
            uploadType: 'media',
            alt: 'json'
          },
          body: value
        }).execute((resp) => {
          if (resp && resp.error && (resp.error.code === 401 || resp.error.code === 404)) {
            this.revokeDrive();
            reject(new Error('error saving. revoking drive: ' + resp.error));
            return;
          } else {
            resolve(value);
          }
        });
      });
    },

    init: function() {
      console.log("gdrive init");
      this.ready.resolve();
    },

    // TODO: need to store gdrive file id in local storage

    // TODO: don't redo this?
    // check if the user is authorized with google drive
    authorize: function() {
      // TODO: first time we do this we should probably merge data? do we need timestamps on everything?
      return new $q((resolve, reject) => {
        console.log('authorizing');
        // we're a chrome app so we do this
        if (window.chrome && chrome.identity) {
          console.log("auth with crhome");
          chrome.identity.getAuthToken({
            interactive: true
          }, function(token) {
            console.log('token', token);
            if (chrome.runtime.lastError) {
              // TODO: use an error
              console.log(chrome.runtime.lastError);
              this.revokeDrive();
              return;
            }

            console.log("Authed");
            gapi.auth.setToken({
              access_token: token
            });
            this.getFileId().then(resolve);
          });
        } else { // otherwise we do the normal auth flow
          console.log("normal auth");
          gapi.auth.authorize(this.drive, function(result) {
            // if no errors, we're good to sync!
            this.drive.immediate = result && !result.error;

            // resolve promise for errors
            if (!result || result.error) {
              reject(new Error(result));
              return;
            }

            console.log("Authed");

            this.getFileId().then(resolve);
          });
        }
      })
        .then((fileId) => {
          this.enabled = true;
          // TODO: cache authorized??
          return fileId;
        });
    },

    getFileName: function() {
      return dimBungieService.getMembership(dimState.active)
        .then((membershipId) => 'DIM-' + $DIM_FLAVOR + '-' + membershipId);
    },

    // load the file from google drive
    getFileId: function() {
      // TODO: need a file per membership?
      // if we already have the fileId, just return.
      if (this.fileId) {
        return $q.resolve(this.fileId);
      }

      this.fileId = localStorage.getItem('gdrive-fileid');
      if (this.fileId) {
        return $q.resolve(this.fileId);
      }

      return this.getFileName()
        .then((fileName) => {
          return new $q((resolve, reject) => {
            // load the drive client.
            gapi.client.load('drive', 'v2', () => {
              // grab all of the list files
              gapi.client.drive.files.list().execute((list) => {
                if (list.code === 401) {
                  reject(new Error($translate.instant('SyncService.GoogleDriveReAuth')));
                  return;
                }

                // look for the saved file.
                for (var i = list.items.length - 1; i > 0; i--) {
                  if (list.items[i].title === fileName) {
                    this.fileId = list.items[i].id;
                    resolve(this.fileId);
                    return;
                  }
                }

                // couldn't find the file, lets create a new one.
                gapi.client.request({
                  path: '/drive/v2/files',
                  method: 'POST',
                  body: {
                    title: fileName,
                    mimeType: 'application/json',
                    parents: [{
                      id: 'appfolder'
                    }]
                  }
                }).execute((file) => {
                  this.fileId = file.id;
                  resolve(this.fileId);
                });
              });
            });
          });
        })
        .then((fileId) => {
          console.log("fileid", fileId);
          localStorage.setItem('gdrive-fileid', fileId);
          return fileId;
        });
    },

    revokeDrive: function() {
      console.log("revoke drive");
      if (this.fileId) {
        this.fileId = undefined;
        this.enabled = false;
        localStorage.removeItem('gdrive-fileid');
      }
    },

    enabled: dimFeatureFlags.gdrive && Boolean(localStorage.getItem('gdrive-fileid')),
    name: 'GoogleDriveStorage'
  };

  const adapters = [
    LocalStorage,
    IndexedDBStorage,
    ChromeSyncStorage,
    GoogleDriveStorage
  ];

  // save data {key: value}
  function set(value, PUT) {
    if (!cached) {
      throw new Error("Must call get at least once before setting");
    }

    if (!PUT && angular.equals(_.pick(cached, _.keys(value)), value)) {
      console.log("already set, skipping", value);
      return $q.when();
    }

    // use replace to override the data. normally we're doing a PATCH
    if (PUT) { // update our data
      cached = value;
    } else {
      angular.extend(cached, value);
    }

    console.log('set', value);


    return adapters.reduce((promise, adapter) => {
      if (adapter.enabled) {
        return promise.then(() => {
          console.log('setting', adapter.name, cached);
          return adapter.set(cached);
        });
        // TODO: catch?
      }
      return promise;
    }, $q.when());
  }

  // get DIM saved data
  function get(force) {
    // if we already have it and we're not forcing a sync
    if (cached && !force) {
      return $q.resolve(cached);
    }

    // TODO: get from all adapters, setting along the way?
    // TODO: this prefers local data always, even if remote data has changed!
    // TODO: old code looked bottom-up

    return adapters.reverse()
      .reduce((promise, adapter) => {
        if (adapter.enabled) {
          return promise.then((value) => {
            if (value) {
              console.log('got from previous', value);
              return value;
            }
            console.log('getting', adapter.name);
            return adapter.get();
          });
          // TODO: catch, set status
        }
        return promise;
      }, $q.when())
      .then((value) => {
        cached = value || {};
        return value;
      });
  }

  // remove something from DIM by key
  function remove(key) {
    // just delete that key, maybe someday save to an undo array?

    if (_.isArray(key)) {
      _.each(key, (k) => {
        delete cached[k];
      });
    } else {
      delete cached[key];
    }
    // TODO: remove where possible, get/set elsewhere?
    return adapters.reduce((promise, adapter) => {
      if (adapter.enabled) {
        if (adapter.remove) {
          return promise.then(() => adapter.remove(key));
        }
        return promise.then(() => adapter.set(cached));
        // TODO: catch?
      }
      return promise;
    }, $q.when());
  }

  function init() {
    return GoogleDriveStorage.init();
  }


  return {
    authorizeGdrive: function() {
      return GoogleDriveStorage.authorize();
    },
    get: get,
    set: set,
    remove: remove,
    init: init,
    adapters: adapters
  };
}
