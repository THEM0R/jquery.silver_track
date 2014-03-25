describe("SilverTrack.Plugins.RemoteContent", function() {
  var request = null;
  var track = null;
  var plugin = null;

  var mockAjaxOnePage = function() {
    spyOn($, "ajax").andCallFake(function(e) {
      e.success(helpers.ajaxResponses.onePage);
    });
  }

  var mockAjaxMultiplePages = function(verificationCallback) {
    spyOn($, "ajax").andCallFake(function(e) {
      e.success(helpers.ajaxResponses.multiplePages);
      if (verificationCallback) {
        verificationCallback(e);
      }
    });
  }

  var processCallbacks = function() {
    return {
      process: function(track, perPage, json) {
        var data = json.data;
        var array = [];

        for (var i = 0; i < perPage; i++) {
          array.push(
            $("<div></div>", {"class": "item"}).
            append($("<img>", {"src": data[i].img_url})).
            append($("<p></p>", {"text": data[i].title}))
          );
        }

        return array;
      },

      updateTotalPages: function(track, json) {
        track.updateTotalPages(json.total_pages);
      }
    }
  }

  var createPlugin = function(opts) {
    return new SilverTrack.Plugins.RemoteContent(
      $.extend(processCallbacks(), opts)
    );
  }

  beforeEach(function() {
    jasmine.Clock.useMock();
    loadFixtures("remote.html");
    jasmine.Ajax.useMock();

    $.fx.off = true;
    track = helpers.remote();
  });

  describe("defaults", function() {
    beforeEach(function() {
      plugin = new SilverTrack.Plugins.RemoteContent();
    });

    it("should have a default 'lazy'", function() {
      expect(plugin.options.lazy).toBe(true);
    });

    it("should have a default 'type'", function() {
      expect(plugin.options.type).toBe("GET");
    });

    it("should have a default 'params'", function() {
      expect(plugin.options.params).toBeDefined();
    });

    it("should have a default 'beforeStart'", function() {
      expect(plugin.options.beforeStart).toBeDefined();
    });

    it("should have a default 'beforeSend'", function() {
      expect(plugin.options.beforeSend).toBeDefined();
    });

    it("should have a default 'beforeAppend'", function() {
      expect(plugin.options.beforeAppend).toBeDefined();
    });

    it("should have a default 'afterAppend'", function() {
      expect(plugin.options.afterAppend).toBeDefined();
    });

    it("should have a default 'process'", function() {
      expect(plugin.options.process).toBeDefined();
    });

    it("should have a default 'updateTotalPages'", function() {
      expect(plugin.options.updateTotalPages).toBeDefined();
    });

    it("should have a default 'onError'", function() {
      expect(plugin.options.onError).toBeDefined();
    });
  });

  describe("Initialization", function() {
    describe("when lazy true", function() {
      beforeEach(function() {
        plugin = new SilverTrack.Plugins.RemoteContent({
          url: "some/url/{page}"
        });
      });

      it("should call 'beforeStart' with an instance of the track", function() {
        spyOn(plugin.options, "beforeStart").andCallThrough();

        track.install(plugin);
        track.start();

        expect(plugin.options.beforeStart).toHaveBeenCalledWith(track);
      });

      it("should load the currentPage", function() {
        expect(track.currentPage).toBe(1);
        spyOn($, "ajax");

        track.install(plugin);
        track.start();
        expect($.ajax.mostRecentCall.args[0]["url"]).toEqual("some/url/" + track.currentPage);
      });

      it("should restart the track", function() {
        mockAjaxOnePage();

        spyOn(track, "restart");
        track.install(plugin);
        track.start();
        expect(track.restart).toHaveBeenCalled();
      });

      it("should be marked as 'filled' after loading the content", function() {
        mockAjaxOnePage();

        track.install(plugin);
        expect(plugin.filled).toBe(false);
        track.start();
        expect(plugin.filled).toBe(true);
      });
    });

    describe("when lazy false", function() {
      beforeEach(function() {
        plugin = new SilverTrack.Plugins.RemoteContent({
          lazy: false,
          url: "some/url/{page}"
        });
      });

      it("should call 'beforeStart' with an instance of the track", function() {
        spyOn(plugin.options, "beforeStart").andCallThrough();

        track.install(plugin);
        track.start();

        expect(plugin.options.beforeStart).toHaveBeenCalledWith(track);
      });

      it("should not load any content", function() {
        expect(track.currentPage).toBe(1);
        spyOn($, "ajax");

        track.install(plugin);
        track.start();
        expect($.ajax).not.toHaveBeenCalled();
      });

      it("should be mark as 'filled'", function() {
        track.install(plugin);
        expect(plugin.filled).toBe(false);
        track.start();
        expect(plugin.filled).toBe(true);
      });
    });
  });

  describe("#next", function() {
    describe("common behavior", function() {
      beforeEach(function() {
        plugin = createPlugin({url: "some/url/{page}"});
        track.install(plugin);
        mockAjaxMultiplePages();
      });

      it("should disable the content loader", function() {
        spyOn(track, "goToPage");

        track.start();
        expect(plugin.loadContentEnabled).toBe(true);
        track.next();
        expect(plugin.loadContentEnabled).toBe(false);
      });

      it("should enable the content loader after animation", function() {
        track.start();
        expect(plugin.loadContentEnabled).toBe(true);
        spyOn(plugin, "afterAnimation").andCallThrough();
        track.next();

        expect(plugin.afterAnimation).toHaveBeenCalled();
        expect(plugin.loadContentEnabled).toBe(true);
      });

      it("should call 'goToPage' with the next page", function() {
        var currentPage = track.currentPage;

        spyOn(track, "goToPage");
        track.start();
        track.next();
        expect(track.goToPage).toHaveBeenCalledWith(currentPage + 1);
      });

      describe("when there is only one page", function() {
        it("should get the first page", function() {
          spyOn(track, "goToPage");

          track.start();
          expect(track.goToPage).toHaveBeenCalledWith(track.currentPage, {animate: false});
        });

        it("should not allow the user to go to the next page", function() {
          var currentPage = track.currentPage;

          spyOn(track, "hasNext").andReturn(false);
          spyOn(track, "goToPage");

          // First query
          track.start();
          track.next();

          expect(track.goToPage).not.toHaveBeenCalledWith(currentPage + 1);
          expect(track.currentPage).toEqual(1);
        });
      });
    });

    describe("when loading content", function() {
      describe("and the url is defined by a string", function() {
        beforeEach(function() {
          plugin = createPlugin({url: "some/url/{page}/{perPage}"});
          track.install(plugin);
        });

        it("should replace {page} and {perPage} tokens", function() {
          mockAjaxMultiplePages(function(ajaxSettings) {
            var page = track.currentPage;
            var perPage = track.options.perPage;
            expect(ajaxSettings.url).toBe("some/url/" + page + "/" + perPage);
          });

          track.start();
        });
      });

      describe("and the url is defined by a function", function() {
        beforeEach(function() {
          plugin = createPlugin({
            url: function(track, page, perPage) {
              return "some/url/" + page + "/" + perPage;
            }
          });
          track.install(plugin);
        });

        it("should pass 'page' and 'perPage' as arguments", function() {
          mockAjaxMultiplePages(function(ajaxSettings) {
            var page = track.currentPage;
            var perPage = track.options.perPage;
            expect(ajaxSettings.url).toBe("some/url/" + page + "/" + perPage);
          });

          track.start();
        });
      });

      describe("and the url is in the cache", function() {
        beforeEach(function() {
          plugin = createPlugin({url: "some/url/{page}"});
          plugin.ajaxCache["some/url/1"] = true;
          track.install(plugin);
        });

        it("should not fetch the content", function() {
          spyOn($, "ajax");
          track.start();
          expect($.ajax).not.toHaveBeenCalled();
        });
      });

      describe("and the url is not in the cache", function() {
        var expectAjaxSetting = function(opts) {
          mockAjaxMultiplePages(function(ajaxSettings) {
            expect(ajaxSettings[opts.attr]).toBe(opts.toBe);
          });
          track.start();
        }

        beforeEach(function() {
          plugin = createPlugin({url: "some/url/{page}"});
          track.install(plugin);
        });

        it("should use the proper context", function() {
          expectAjaxSetting({attr: "context", toBe: track.container});
        });

        it("should use the configured type", function() {
          expectAjaxSetting({attr: "type", toBe: plugin.options.type});
        });

        it("should use the configured params", function() {
          plugin.options.params = {1: 2};
          expectAjaxSetting({attr: "data", toBe: plugin.options.params});
        });

        it("should call 'beforeSend'", function() {
          spyOn(plugin.options, "beforeSend").andCallThrough();
          track.start();
          expect(plugin.options.beforeSend).
            toHaveBeenCalledWith(track, jasmine.any(Object), jasmine.any(Object));
        });

        it("should add the url into the cache", function() {
          mockAjaxMultiplePages();
          expect(plugin.ajaxCache["some/url/1"]).toBe(undefined);
          track.start();
          expect(plugin.ajaxCache["some/url/1"]).toBe(true);
        });

        it("should call 'process'", function() {
          mockAjaxMultiplePages();
          spyOn(plugin.options, "process")
          track.start();

          var perPage = track.options.perPage;
          var data = helpers.ajaxResponses.multiplePages;
          expect(plugin.options.process).toHaveBeenCalledWith(track, perPage, data);
        });

        it("should call 'beforeAppend'", function() {
          mockAjaxMultiplePages();
          spyOn(plugin.options, "beforeAppend");
          track.start();
          expect(plugin.options.beforeAppend).toHaveBeenCalledWith(track, jasmine.any(Object));
        });

        it("should call 'afterAppend'", function() {
          mockAjaxMultiplePages();
          spyOn(plugin.options, "afterAppend");
          track.start();
          expect(plugin.options.afterAppend).toHaveBeenCalledWith(track, jasmine.any(Object));
        });

        it("should call 'updateTotalPages'", function() {
          mockAjaxMultiplePages();
          spyOn(plugin.options, "updateTotalPages");
          track.start();

          var data = helpers.ajaxResponses.multiplePages;
          expect(plugin.options.updateTotalPages).toHaveBeenCalledWith(track, data);
        });

        it("should reload the items", function() {
          mockAjaxMultiplePages();
          spyOn(track, "reloadItems");
          track.start();
          expect(track.reloadItems).toHaveBeenCalled();
        });

        it("should call 'goToPage' with the proper page after the request", function() {
          mockAjaxMultiplePages();
          spyOn(track, "goToPage");
          track.start();
          track.next();
          expect(track.goToPage).toHaveBeenCalledWith(track.currentPage + 1);
        });
      });
    });
  });

});