/**
 * Expose the `Swagger` plugin.
 */
module.exports = Swagger;

/**
 * Module dependencies.
 */
var Remoting = require('../');

/**
 * Create a remotable Swagger module for plugging into a SharedClassCollection.
 */
function Swagger(remotes, options) {
  // Unfold options.
  var _options = options || {};
  var name = _options.name || 'swagger';
  var version = _options.version;
  var basePath = _options.basePath;

  // We need a temporary REST adapter to discover our available routes.
  var adapter = remotes.handler('rest').adapter;
  var routes = adapter.allRoutes();
  var classes = remotes.classes();

  var extension = {};
  var helper = Remoting.extend(extension);

  var apiDocs = {};
  var resourceDoc = {
    apiVersion: version,
    swaggerVersion: '1.1',
    basePath: basePath,
    apis: []
  };

  classes.forEach(function (item) {
    resourceDoc.apis.push({
      path: '/' + name + '/' + item.name,
      description: item.ctor.sharedCtor && item.ctor.sharedCtor.description
    });

    console.log(item.name);

    apiDocs[item.name] = {
      apiVersion: resourceDoc.apiVersion,
      swaggerVersion: resourceDoc.swaggerVersion,
      basePath: resourceDoc.basePath,
      apis: []
    };

    helper.method(api, {
      path: item.name,
      returns: { type: 'object', root: true }
    });
    function api(callback) {
      callback(null, apiDocs[item.name]);
    }
  });

  routes.forEach(function (route) {
    var split = route.method.split('.');
    var doc = apiDocs[split[0]];

    if (!doc) {
      console.error('Route exists with no class: %j', route);
      return;
    }

    doc.apis.push(routeToAPI(route));
  });

  console.log('Classes:');
  console.log(JSON.stringify(classes, null, 2));
  console.log('Routes:');
  console.log(JSON.stringify(routes, null, 2));

  /**
   * The topmost Swagger resource is a description of all (non-Swagger) resources
   * available on the system, and where to find more information about them.
   */
  helper.method(resources, {
    returns: [{ type: 'object', root: true }]
  });
  function resources(callback) {
    callback(null, resourceDoc);
  }

  remotes.exports[name] = extension;
  return extension;
}

/**
 * Converts from an sl-remoting-formatted "Route" description to a
 * Swagger-formatted "API" description.
 */

function routeToAPI(route) {
  return {
    path: convertPathFragments(route.path),
    operations: [{
      httpMethod: (route.verb.toLowerCase() === 'all' ? 'POST' : route.verb.toUpperCase()),
      nickname: route.method,
      responseClass: prepareDataType(route.returns && route.returns[0].type),
      parameters: route.accepts ? route.accepts.map(acceptToParameter(route)) : [],
      errorResponses: [], // TODO(schoon) - We don't have descriptions for this yet.
      summary: route.description,
      notes: '' // TODO(schoon) - `description` metadata
    }]
  };
}

/**
 * Converts from an sl-remoting-formatted "Accepts" description to a
 * Swagger-formatted "Parameter" description.
 */

function acceptToParameter(route) {
  var type = 'form';

  if (route.verb.toLowerCase() === 'get') {
    type = 'query';
  }

  return function (accepts) {
    var name = accepts.name || accepts.arg;
    var paramType = type;

    // TODO: Regex. This is leaky.
    if (route.path.indexOf(':' + name) !== -1) {
      paramType = 'path';
    }

    return {
      paramType: paramType || type,
      name: name,
      description: accepts.description,
      dataType: prepareDataType(accepts.type),
      required: !!accepts.required,
      allowMultiple: false
    };
  };
}

/**
 * Converts from an sl-remoting data type to a Swagger dataType.
 */

function prepareDataType(type) {
  if (!type) {
    return 'void';
  }

  // TODO(schoon) - Add support for complex dataTypes, "models", etc.
  switch (type) {
    case 'buffer':
      return 'byte';
    case 'date':
      return 'Date';
    case 'number':
      return 'double';
  }

  return type;
}
