import angular from 'angular';
import 'babel-polyfill';

import './app/google';

// Drag and drop
import iosDragDropShim from 'drag-drop-webkit-mobile';

// Initialize the main DIM app
import './app/app.module';

import './app/services/dimActionQueue.factory';
import './app/services/dimDefinitions.factory';
import './app/services/dimManifestService.factory';
import './app/services/dimBucketService.factory';
import './app/services/dimInfoService.factory';
import './app/services/dimPlatformService.factory';
import './app/services/dimDestinyTrackerService.factory';

import './app/shell/dimAngularFilters.filter';
import './app/shell/dimClickAnywhereButHere.directive';
import './app/shell/dimManifestProgress.directive';

import './scss/main.scss';

iosDragDropShim({
  enableEnterLeave: true,
  holdToDrag: 300
});

// https://github.com/timruffles/ios-html5-drag-drop-shim/issues/77
window.addEventListener('touchmove', () => {});

if ($DIM_FLAVOR !== 'dev' && navigator.serviceWorker) {
  navigator.serviceWorker.register('/service-worker.js')
    .catch((err) => {
      console.error('Unable to register service worker.', err);
    });
}

angular.bootstrap(document.body, ['app'], { strictDi: true });
