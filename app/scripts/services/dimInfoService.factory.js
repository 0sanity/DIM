(function() {
  'use strict';

  angular.module('dimApp')
    .factory('dimInfoService', InfoService);

  InfoService.$inject = ['toaster'];

  function InfoService(toaster) {
    return {
      show: function(id, content) {
        content = content || {};
        content.title = content.title || '';
        content.body = content.body || '';
        content.hide = content.hide || '';

        chrome.storage.sync.get('info.' + id, function(data) {
          if(_.isNull(data) || _.isEmpty(data)) {
            toaster.pop({
              type: 'info',
              title: content.title,
              body: [
                content.body,
                '<input style="margin-top: 1px; vertical-align: middle;" id="info-' + id + '" type="checkbox">',
                '<label for="info-' + id + '">' + content.hide + '</label></p>'
              ].join(''),
              timeout: 0,
              bodyOutputType: 'trustedHtml',
              showCloseButton: true,
              clickHandler: function(a, b, c, d, e, f, g) {
                if(b) {
                  return true;
                }
                return false;
              },
              onHideCallback: function() {
                if($('#info-' + id)
                  .is(':checked')) {
                  var save = {};
                  save['info.' + id] = 1;
                  chrome.storage.sync.set(save, function(e) {});
                }
              }
            });
          }
        });
      }
    };
  }
})();
