"use strict";
/* globals require, module */

var path = require('path'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    mv = require('mv'),
    async = require('async'),
    nconf = require.main.require('nconf'),
    {resolve} = require('path'),
    shell = require('any-shell-escape'),
    {exec} = require('child_process'),
    pathToFfmpeg = require('ffmpeg-static');

var db = require.main.require('./src/database');

var controllers = require('./lib/controllers');

var plugin = {
        embedRegex: /\[video\/([\w\-_.]+)\]/g
    },
    app;

plugin.init = function(params, callback) {
    var router = params.router,
        hostMiddleware = params.middleware,
        multiparty = require.main.require('connect-multiparty')();

    app = params.app;

    router.get('/admin/plugins/video-embed', hostMiddleware.admin.buildHeader, controllers.renderAdminPage);
    router.get('/api/admin/plugins/video-embed', controllers.renderAdminPage);
    router.post('/plugins/nodebb-plugin-video-embed/upload', multiparty, hostMiddleware.validateFiles, hostMiddleware.applyCSRF, controllers.upload);

    mkdirp(path.join(nconf.get('upload_path'), 'video-embed'), callback);
};

plugin.addAdminNavigation = function(header, callback) {
    header.plugins.push({
        route: '/plugins/video-embed',
        icon: 'fa-play',
        name: 'Video Embed'
    });

    callback(null, header);
};

plugin.registerFormatting = function(payload, callback) {
    payload.options.push({ name: 'video-embed', className: 'fa fa-video' });
    callback(null, payload);
};
//todo check if classname needs to be changed
plugin.processUpload = function(payload, callback) {
    if (payload.type.startsWith('video/')) {
        var id = path.basename(payload.path),
            uploadPath = path.join(nconf.get('upload_path'), 'video-embed', id);

        async.waterfall([
            async.apply(shell,[pathToFfmpeg,'-i',payload.path,'-c:v','libvpx-vp9','-r','24','s','480x270','b:v','128k','-threads','2','-speed','1','tile-columns','6',
                'frame-parallel','1','-auto-alt-ref','1','-lag-in-frames','12','-c:a','libopus','-b:a','12k','-f','webm',uploadPath.substr(0, uploadPath.lastIndexOf(".")) + ".webm"
            ]),
            //async.apply(mv, payload.path, uploadPath), delete of original
            async.apply(db.setObject, 'video-embed:id:' + id, {
                name: payload.name.substr(0, payload.name.lastIndexOf(".")) + ".webm",
                size: /*payload.size*/fs.statSync(uploadPath.substr(0, uploadPath.lastIndexOf(".")) + ".webm").size
            }),
            async.apply(db.sortedSetAdd, 'video-embed:date', +new Date(), id)
        ], function(err) {
            if (err) {
                return callback(err);
            }

            callback(null, {
                id: id
            });
        });
    } else {
        callback(new Error('invalid-file-type'));
    }
};

plugin.parsePost = function(data, callback) {
    if (!data || !data.postData || !data.postData.content) {
        return callback(null, data);
    }

    plugin.parseRaw(data.postData.content, function(err, content) {
        if (err) {
            return callback(err);
        }

        data.postData.content = content;
        callback(null, data);
    });
};

plugin.parseRaw = function(content, callback) {
    var matches = content.match(plugin.embedRegex);

    if (!matches) {
        return callback(null, content);
    }

    // Filter out duplicates
    matches = matches.filter(function(match, idx) {
        return idx === matches.indexOf(match);
    }).map(function(match) {
        return match.slice(7, -1);
    });

    async.filter(matches, plugin.exists, function(err, ids) {
        async.reduce(ids, content, function(content, id, next) {
            app.render('partials/video-embed', {
                id: id,
                path: path.join(nconf.get('relative_path'), '/uploads/video-embed', id)
            }, function(err, html) {
                content = content.replace('[video/' + id + ']', html);
                next(err, content);
            });
        }, callback);
    });
};

plugin.exists = function(id, callback) {
    db.isSortedSetMember('video-embed:date', id, callback);
};

module.exports = plugin;
