/**
 * Expose `RestAdapter`.
 */

module.exports = RestAdapter;

/**
 * Module dependencies.
 */
 
var EventEmitter = require('events').EventEmitter
  , debug = require('debug')('rest-adapter')
  , util = require('util')
  , inherits = util.inherits
  , assert = require('assert')
  , express = require('express')
  , HttpContext = require('./http-context')
  
/**
 * Create a new `RestAdapter` with the given `options`.
 *
 * @param {Object} options
 * @return {RestAdapter}
 */

function RestAdapter(remotes) {
  EventEmitter.apply(this, arguments);
  
  // throw an error if args are not supplied
  // assert(typeof options === 'object', 'RestAdapter requires an options object');
  
  this.remotes = remotes;
  this.Context = HttpContext;
}

/**
 * Inherit from `EventEmitter`.
 */

inherits(RestAdapter, EventEmitter);

/*!
 * Simplified APIs
 */

RestAdapter.create =
RestAdapter.createRestAdapter = function (remotes) {
  // add simplified construction / sugar here
  return new RestAdapter(remotes);
}

/**
 * Get the path for the given method.
 */

RestAdapter.prototype.getRoutes = function (obj) {
  var fn = (obj.fn || obj.ctor);
  var routes = fn && fn.http;
  
  if(routes && !Array.isArray(routes)) {
    routes = [routes];
  }
  
  // overidden
  if(routes) {
    // patch missing verbs / routes
    routes.forEach(function (r) {
      r.verb = r.verb || 'get';
      r.path = r.path || ('/' + obj.name);
    });
  } else {
    // build default route
    routes = [{
      verb: 'get',
      path: obj.name ? ('/' + obj.name) : ''
    }];
  }
  
  return routes;
}

RestAdapter.prototype.createHandler = function () {
  var root = express();
  var adapter = this;
  var Context = this.Context;
  var classes = this.remotes.classes();
  
  classes.forEach(function (sc) {
    var app = express();
    var methods = sc.methods();

    methods.forEach(function (method) {
      adapter
        .getRoutes(method)
        .forEach(function (route) {
          if(method.isStatic) {
            app[route.verb](route.path, function (req, res, next) {
              var ctx = new Context(req, res);

              // invoke the static method on the actual constructor
              ctx.invoke(method.ctor, method, function (err, result) {
                if(err) return next(err);
              
                res.send(result);
              });
            });
          } else {
            adapter
              .getRoutes(method.sharedCtor)
              .forEach(function (sharedCtorRoute) {
                app[route.verb](sharedCtorRoute.path + route.path, function (req, res, next) {
                  var ctx = new Context(req, res);
                  
                  // invoke the shared constructor to get an instance
                  ctx.invoke(method, method.sharedCtor, function (err, inst) {
                    if(err) {
                      next(err);
                    } else {
                      
                      // invoke the instance method
                      ctx.invoke(inst, method, function (err, result) {
                        if(err) return next(err);
              
                        res.send(result);
                      });
                    }
                  });
                });
              });
          }
        });
    });

    adapter
      .getRoutes(sc)
      .forEach(function (route) {
        root.use(route.path, app);
      });
  });

  return root;
}

/**
 * Create a rest client.
 */

RestAdapter.prototype.client = 
RestAdapter.prototype.createClient = function () {
  
}