/* eslint-env node */

/*
 * This script will copy all of the localisation language files from the Intl.RelativeTimeFormat
 * module and install them within a folder in this directory named ~locale.
 *
 * The detect.js file used for Intl is copied into every ~locale polyfill for
 * use on detecting whether that locale needs to be polyfilled.
 *
 * The config.toml file for each locale polyfill is based off of the one for
 * Intl. The changes made ot it are:
 *  - Removing the "install" section
 *  - Adding Intl as a dependency
 */

'use strict';

var fs = require('graceful-fs');
var path = require('path');
var LocalesPath = path.dirname(require.resolve('@formatjs/intl-relativetimeformat/locale-data/en.js'));
var PluralRulesLocalesPath = path.dirname(require.resolve('@formatjs/intl-pluralrules/locale-data/en.js'));
var NumberFormatLocalesPath = path.dirname(require.resolve('@formatjs/intl-numberformat/locale-data/en.js'));
var IntlPolyfillOutput = path.resolve('polyfills/Intl/RelativeTimeFormat');
var LocalesPolyfillOutput = path.resolve('polyfills/Intl/RelativeTimeFormat/~locale');
var mkdirp = require('mkdirp');
var TOML = require('@iarna/toml');
var localeMatcher = require('@formatjs/intl-localematcher');

function writeFileIfChanged (filePath, newFile) {
	if (fs.existsSync(filePath)) {
		var currentFile = fs.readFileSync(filePath);

		if (newFile !== currentFile) {
			fs.writeFileSync(filePath, newFile);
		}
	} else {
		fs.writeFileSync(filePath, newFile);
	}
}

var pluralRulesLocales = new Set(
	fs.readdirSync(PluralRulesLocalesPath).filter(function(f)  {
		return f.endsWith('.js');
	}).map((f) => {
		return f.slice(0, f.indexOf('.'));
	})
);

var numberFormatLocales = new Set(
	fs.readdirSync(NumberFormatLocalesPath).filter(function(f)  {
		return f.endsWith('.js');
	}).map((f) => {
		return f.slice(0, f.indexOf('.'));
	})
);

function localeDependencies(locale) {
	const out = [];

	const pluralRulesMatch = localeMatcher.match([locale], Array.from(pluralRulesLocales));
	if (pluralRulesMatch) {
		out.push(`Intl.PluralRules.~locale.${pluralRulesMatch}`)
	}

	const numberFormatMatch = localeMatcher.match([locale], Array.from(numberFormatLocales));
	if (numberFormatMatch) {
		out.push(`Intl.NumberFormat.~locale.${numberFormatMatch}`)
	}

	return out;
}

var configSource = TOML.parse(fs.readFileSync(path.join(IntlPolyfillOutput, 'config.toml'), 'utf-8'));
delete configSource.install;

if (!fs.existsSync(LocalesPolyfillOutput)) {
	mkdirp.sync(LocalesPolyfillOutput);
}

// customizing the config to add intl as a dependency
configSource.dependencies.push('Intl.RelativeTimeFormat');

// don't test every single locale - it will be too slow
configSource.test = { ci: false };

function intlLocaleDetectFor(locale) {
	return "'Intl' in self && " +
			"Intl.RelativeTimeFormat && " +
			"Intl.RelativeTimeFormat.supportedLocalesOf && " +
			"Intl.RelativeTimeFormat.supportedLocalesOf('"+locale+"').length === 1";
}

console.log('Importing Intl.RelativeTimeFormat~locale.* polyfill from ' + LocalesPath);
var locales = fs.readdirSync(LocalesPath);
locales.filter(function(f)  {
	return f.endsWith('.js')
}).forEach(function (file) {
	var locale = file.slice(0, file.indexOf('.'));
	var localeOutputPath = path.join(LocalesPolyfillOutput, locale);

	if (!fs.existsSync(localeOutputPath)) {
		mkdirp.sync(localeOutputPath);
	}

	var localePolyfillSource = fs.readFileSync(path.join(LocalesPath, file));
	var polyfillOutputPath = path.join(localeOutputPath, 'polyfill.js');
	var detectOutputPath = path.join(localeOutputPath, 'detect.js');
	var configOutputPath = path.join(localeOutputPath, 'config.toml');
	writeFileIfChanged(polyfillOutputPath, localePolyfillSource);
	writeFileIfChanged(detectOutputPath, intlLocaleDetectFor(locale));
	writeFileIfChanged(
		configOutputPath,
		TOML.stringify({
			...configSource,
			dependencies: [
				...configSource.dependencies,
				...localeDependencies(locale)
			].sort()
		})
	);
});


console.log(locales.length + ' imported locales');
console.log('Intl.RelativeTimeFormat polyfill imported successfully');
