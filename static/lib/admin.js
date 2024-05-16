'use strict';
/* globals $, app, socket, define */

define('admin/plugins/video-embed', ['settings', 'alerts'], function(Settings, alerts) {

	var ACP = {};

	ACP.init = function() {
		Settings.load('video-embed', $('.video-embed-settings'));

		$('#save').on('click', function() {
			Settings.save('video-embed', $('.video-embed-settings'), function() {
				alerts.alert({
					type: 'success',
					alert_id: 'video-embed-saved',
					title: 'Settings Saved',
					message: 'Please reload your NodeBB to apply these settings',
					clickfn: function() {
						socket.emit('admin.reload');
					}
				});
			});
		});
	};

	return ACP;
});