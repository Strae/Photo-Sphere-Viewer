# Photo Sphere Viewer

[![Bower version](https://img.shields.io/bower/v/Photo-Sphere-Viewer.svg?style=flat-square)](http://photo-sphere-viewer.js.org)
[![Build Status](https://img.shields.io/travis/mistic100/Photo-Sphere-Viewer/master.svg?style=flat-square)](https://travis-ci.org/mistic100/Photo-Sphere-Viewer)

Photo Sphere Viewer is a JavaScript library that allows you to display 360×180 degrees panoramas on any web page. Panoramas must use the equirectangular projection and can be taken with the Google Camera, the Ricoh Theta or any 360° camera.

Forked from [JeremyHeleine/Photo-Sphere-Viewer](https://github.com/JeremyHeleine/Photo-Sphere-Viewer).

## Documentation
http://photo-sphere-viewer.js.org

## Dependencies
 * [three.js](http://threejs.org)
 * [doT.js](http://olado.github.io/doT) (@master)
 * [uEvent](https://github.com/mistic100/uEvent)
 * [D.js](http://malko.github.io/D.js)

## New Functions

### Caching

 * `PSV.preloadPano()` Preload a panorama image into the internal cache
 * `PSV.clearCachedPanoramas([pano])` If pano is given, remove it from the cache; Else, clear all the caches.
 * `PSV.getCacheSize()` Return the number of item cached.
 * `PSV.getCache()` Return the whole cache element.

## Build

### Prerequisites
 * NodeJS + NPM: `apt-get install nodejs-legacy npm`
 * Ruby Dev: `apt-get install ruby-dev`
 * Grunt CLI: `npm install -g grunt-cli`
 * Bower: `npm install -g bower`
 * SASS: `gem install sass`

### Run

Install Node and Bower dependencies `npm install & bower install` then run `grunt` in the root directory to generate production files inside `dist`.

### Other commands

 * `grunt test` to run jshint/jscs/scsslint.
 * `grunt watch` to automatically build the library when modifying the source files.
 * `grunt server` to open the example page with automatic build and livereload.

## License
This library is available under the MIT license.
