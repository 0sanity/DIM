(function(angular) {
  'use strict';

  angular.module('dimApp')
    .factory('SyncService', SyncService);

  SyncService.$inject = ['$q', '$window'];

  function toOpenLoadout(loadouts) {
    var ret = {};
    for(var membershipId in loadouts) {
      ret[membershipId] = [];
      loadouts[membershipId].forEach(function(loadout) {
        ret[membershipId].push({
          guid: loadout.id,
          name: loadout.name,
          platform: loadout.platform,
          subclass: loadout.classType,
          equip: _.map(_.filter(loadout.items, function(item) { return item.amount === 1 && item.equipped; }), function(item) { return item.id; }),
          inventory: _.map(_.filter(loadout.items, function(item) { return item.amount === 1 && !item.equipped; }), function(item) { return item.id; }),
          stackable: _.map(_.filter(loadout.items, function(item) { return item.amount > 1; }), function(item) { return { hash: item.hash, amount: item.amount }; }),
        });
      });
    }
    return ret;
  }

  function toDIMLoadout(loadouts) {
    var ret = {};
    for(var membershipId in loadouts) {
      ret[membershipId] = [];

      loadouts[membershipId].forEach(function(loadout) {
        var items = [];
        loadout.equip.forEach(function(item) {
          items.push({
            id: item,
            amount: 1,
            equipped: true
          });
        });
        loadout.inventory.forEach(function(item) {
          items.push({
            id: item,
            amount: 1,
            equipped: false
          });
        });
        loadout.stackable.forEach(function(item) {
          items.push({
            hash: item.hash,
            amount: item.amount,
            equipped: false
          });
        });

        ret[membershipId].push({
          id: loadout.guid,
          name: loadout.name,
          platform: loadout.platform,
          classType: loadout.subclass,
          version: 'v4.0',
          items: items
        });
      });
    }
    return ret;
  }

  function SyncService($q, $window) {
    var cached; // cached is the data in memory,
    var drive = { // drive api data
      client_id: '$GAPI_VERSION.apps.googleusercontent.com',
      scope: 'https://www.googleapis.com/auth/drive.appfolder',
      immediate: false
    };
    var ready = $q.defer();

    function init() {
      return ready.resolve();
    }

    function revokeDrive() {
      if (cached && cached.loadoutFileId) {
        remove('loadoutFileId');
      }
    }

    // promise to find the file id from google drive
    function getFileId(fileName) {

      // create a file in the appDataFolder
      function createFile(fileName, callback) {
        gapi.client.drive.files.create({
          fields: 'id',
          resource: {
            name: fileName,
            parents: ['appDataFolder']
          }
        }).execute(function(resp) {
          if(!resp || !resp.id) {
            console.log(resp);
            return;
          }
          callack(resp.id);
        });
      }

      // list all the files in the appDataFolder, grab the fileId + return.
      function getOrCreateId(fileName, callback) {
        gapi.client.drive.files.list({
          q: 'name="' + fileName + '"',
          spaces: 'appDataFolder',
          fields: 'files(id)'
        }).execute(function(resp) {
          if(!resp || !resp.files) {
            console.warn('Error connecting to Open Loadouts', resp);
            return;
          }
          // if there isn't one, make one.
          if (!resp.files.length) {
            createFile(fileName, callback);
            return;
          }
          callback(resp.files[0].id);
        });
      }

      // load google
      var ret = $q.defer();
      gapi.client.load('drive', 'v3', function() {
        // grab or create file id
        getOrCreateId(fileName, function(id) {
          return ret.resolve(id);
        });
      });
      return ret.promise;
    }

    // check if the user is authorized with google drive
    function authorize() {
      var authed = $q.defer();

      // we're a chrome app so we do this
      if (chrome.identity) {
        chrome.identity.getAuthToken({
          interactive: true
        }, function(token) {
          if (chrome.runtime.lastError) {
            revokeDrive();
            return;
          }
          gapi.auth.setToken({
            access_token: token
          });
          getFileId("Open.Loadout").then(function(id) {
            set({
              loadoutFileId: id
            });
            authed.resolve(id);
          });
        });
      } else {
        // otherwise we do the normal auth flow
        gapi.auth.authorize(drive, function(result) {
          if (!result || result.error) {
            revokeDrive();
            return;
          }
          drive.immediate = result && !result.error;
          getFileId("Open.Loadout").then(function(id) {
            set({
              loadoutFileId: id
            });
            authed.resolve(id);
          });
        });
      }
      return authed.promise;
    }

    function getDriveFile(id) {
      var d = $q.defer();

      gapi.client.drive.files.get({
        fileId: id,
        alt: 'media'
      }).execute(function(resp) {
        if (resp.code === 401 || resp.code === 404) {
          revokeDrive();
          return;
        }
        d.resolve(resp);
      });

      return d.promise;
    }

    // save data {key: value}
    function set(value, PUT) {
      if(!cached) {
        return;
      }
      //----
      // TODO:
      // if value === cached, we don't need to save....
      // this is a very naive check.
      //----
      //      if(JSON.stringify(value) === JSON.stringify(cached)) {
      //        console.log('nothing changed.');
      //        return;
      //      }

      // use replace to override the data. normally we're doing a PATCH
      if (PUT) { // update our data
        cached = value;
      } else if (cached) {
        angular.extend(cached, value);
      } else {
        cached = value;
      }

      console.log('saving', cached)

      // save to local storage
      localStorage.setItem('DIM', JSON.stringify(cached));

      // save to chrome sync
      if (chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set(cached, function() {
          if (chrome.runtime.lastError) {
            //            console.log('error with chrome sync.')
          }
        });
      }

      // save to google drive
      if (cached.loadoutFileId) {
        gapi.client.request({
          path: '/upload/drive/v3/files/' + cached.loadoutFileId,
          method: 'PATCH',
          params: {
            uploadType: 'media',
            alt: 'json'
          },
          body: toOpenLoadout(cached['loadouts-v4.0'])
        }).execute(function(resp) {
          if (resp && resp.error && (resp.error.code === 401 || resp.error.code === 404)) {
            console.log('error saving. revoking drive.');
            revokeDrive();
            return;
          }
        });
      }
    }

    // get DIM saved data
    function get(force) {
      // if we already have it and we're not forcing a sync
      if (cached && !force) {
        return $q.resolve(cached);
      }

      var deferred = $q.defer();

      // grab from localStorage first
      cached = JSON.parse(localStorage.getItem('DIM'));

      // if we have drive sync enabled, get from google drive
      // eventually we could use this for DIM to drive...
//      if (fileId || (cached && cached.fileId)) {
//        fileId = fileId || cached.fileId;
//
//        ready.promise.then(authorize).then(function() {
//          gapi.client.load('drive', 'v3', function() {
//            gapi.client.drive.files.get({
//              fileId: fileId,
//              alt: 'media'
//            }).execute(function(resp) {
//              if (resp.code === 401 || resp.code === 404) {
//                revokeDrive();
//                return;
//              }
//              console.log('well hello', resp);
//
//              cached = resp;
//              deferred.resolve(cached);
//              return;
//            });
//          });
//        });
//      } // else get from chrome sync
      if (chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(null, function(data) {
          cached = data;

          ready.promise.then(authorize).then(function() {
            getDriveFile(cached.loadoutFileId).then(function(data) {
              cached['loadouts-v4.0'] = toDIMLoadout(data.result);
              deferred.resolve(cached);
            });
          });
        });
      } // otherwise, just use local storage
      else {
        deferred.resolve(cached);
      }

      return deferred.promise;
    }

    // remove something from DIM by key
    function remove(key) {
      // just delete that key, maybe someday save to an undo array?
      delete cached[key];

      // sync to data storage
      set(cached, true);
    }

    return {
      authorize: authorize,
      get: get,
      set: set,
      remove: remove,
      init: init,
      drive: function() {
        return cached && cached.loadoutFileId === undefined;
      }
    };
  }
})(angular);
