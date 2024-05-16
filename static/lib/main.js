"use strict";
/* globals $, require */

$(document).ready(function() {
	function upload(callback) {
		require(['uploader'], function (uploader) {
			uploader.show({
				title: 'Upload Video',
				description: 'Upload an video file for embedding into your post',
				route: config.relative_path + '/plugins/nodebb-plugin-video-embed/upload'
			}, callback);
		});
	}

	$(window).on('action:composer.loaded', function (ev, data) {
		require(['composer/formatting', 'composer/controls'], function(formatting, controls) {
			if (formatting && controls) {
				formatting.addButtonDispatch('video-embed', function(textarea, selectionStart, selectionEnd){
					upload(function (id) {
						controls.insertIntoTextarea(textarea, '[video/' + id + ']');
						controls.updateTextareaSelection(textarea, id.length + 8, id.length + 8);
					});
				});
			}
		});

		if ($.Redactor) {
			$.Redactor.opts.plugins.push('video-embed');
		}
	});

	$(window).on('action:redactor.load', function() {
		$.Redactor.prototype['video-embed'] = function () {
			return {
				init: function () {
					var self = this;

					// require translator as such because it was undefined without it
					require(['translator'], function (translator) {
						translator.translate('Embed Video', function (translated) {
							var button = self.button.add('video-embed', translated);
							self.button.setIcon(button, '<i class="fa fa-video"></i>');
							self.button.addCallback(button, self['video-embed'].onClick);
						});
					});
				},
				onClick: function () {
					var self = this;
					upload(function (id) {
						require(['benchpress'], (Benchpress) => {
							Benchpress.parse('partials/video-embed', {
								path: config.relative_path + '/uploads/video-embed/' + id
							}, function (html) {
								self.insert.html(html);
							});
						});
					});
				}
			};
		};
	});
});