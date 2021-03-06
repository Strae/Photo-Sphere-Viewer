/**
 * Loads the XMP data with AJAX
 * @returns {promise}
 * @private
 */
PhotoSphereViewer.prototype._loadXMP = function() {
  if (!this.config.usexmpdata) {
    return D.resolved(null);
  }

  var defer = D();
  var xhr = new XMLHttpRequest();
  var self = this;
  var progress = 0;

  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status === 200 || xhr.status === 201 || xhr.status === 202 || xhr.status === 0) {
        if (self.loader) {
          self.loader.setProgress(100);
        }

        var binary = xhr.responseText;
        var a = binary.indexOf('<x:xmpmeta'), b = binary.indexOf('</x:xmpmeta>');
        var data = binary.substring(a, b);

        // No data retrieved
        if (a === -1 || b === -1 || data.indexOf('GPano:') === -1) {
          defer.resolve(null);
        }
        else {
          var pano_data = {
            full_width: parseInt(PSVUtils.getXMPValue(data, 'FullPanoWidthPixels')),
            full_height: parseInt(PSVUtils.getXMPValue(data, 'FullPanoHeightPixels')),
            cropped_width: parseInt(PSVUtils.getXMPValue(data, 'CroppedAreaImageWidthPixels')),
            cropped_height: parseInt(PSVUtils.getXMPValue(data, 'CroppedAreaImageHeightPixels')),
            cropped_x: parseInt(PSVUtils.getXMPValue(data, 'CroppedAreaLeftPixels')),
            cropped_y: parseInt(PSVUtils.getXMPValue(data, 'CroppedAreaTopPixels'))
          };

          if (!pano_data.full_width || !pano_data.full_height || !pano_data.cropped_width || !pano_data.cropped_height) {
            console.warn('PhotoSphereViewer: invalid XMP data');
            defer.resolve(null);
          }
          else {
            defer.resolve(pano_data);
          }
        }
      }
      else {
        self.container.textContent = 'Cannot load image';
        throw new PSVError('Cannot load image');
      }
    }
    else if (xhr.readyState === 3) {
      if (self.loader) {
        self.loader.setProgress(progress += 10);
      }
    }
  };

  xhr.onprogress = function(e) {
    if (e.lengthComputable && self.loader) {
      var new_progress = parseInt(e.loaded / e.total * 100);
      if (new_progress > progress) {
        progress = new_progress;
        self.loader.setProgress(progress);
      }
    }
  };

  xhr.onerror = function() {
    self.container.textContent = 'Cannot load image';
    throw new PSVError('Cannot load image');
  };

  if (true === this.config.caching.enabled && true === this.isPanoCached(this.config.panorama)) {
    var cachedPano = self._getPanoCache(this.config.panorama);
    defer.resolve(cachedPano.xmpdata);
  }
  else {
    xhr.open('GET', this.config.panorama, true);
    xhr.send(null);
  }
  return defer.promise;
};

/**
 * Loads the sphere texture
 * @param {String} pano - The panorama image uri - if not set, use config.panorama
 * @returns {promise}
 * @private
 */
PhotoSphereViewer.prototype._loadTexture = function(pano) {
  var self = this;
  var targetPano = pano || self.config.panorama;

  if (this.isPanoCached(targetPano)) {
    var cachedPano = this._getPanoCache(targetPano);
    return D.resolved(cachedPano.texture);
  }


  return this._loadXMP().then(function(pano_data) {
    var defer = D();
    var loader = new THREE.ImageLoader();
    var progress = pano_data ? 100 : 0;

    loader.setCrossOrigin('anonymous');

    var onload = function(img) {
      if (self.loader) {
        self.loader.setProgress(100);
      }

      // Config XMP data
      if (!pano_data && self.config.pano_data) {
        pano_data = PSVUtils.clone(self.config.pano_data);
      }

      // Default XMP data
      if (!pano_data) {
        pano_data = {
          full_width: img.width,
          full_height: img.height,
          cropped_width: img.width,
          cropped_height: img.height,
          cropped_x: 0,
          cropped_y: 0
        };
      }

      self.prop.pano_data = pano_data;

      var r = Math.min(pano_data.full_width, PhotoSphereViewer.SYSTEM.maxTextureWidth) / pano_data.full_width;
      var resized_pano_data = PSVUtils.clone(pano_data);

      resized_pano_data.full_width *= r;
      resized_pano_data.full_height *= r;
      resized_pano_data.cropped_width *= r;
      resized_pano_data.cropped_height *= r;
      resized_pano_data.cropped_x *= r;
      resized_pano_data.cropped_y *= r;

      img.width = resized_pano_data.cropped_width;
      img.height = resized_pano_data.cropped_height;

      // create a new image containing the source image and black for cropped parts
      var buffer = document.createElement('canvas');
      buffer.width = resized_pano_data.full_width;
      buffer.height = resized_pano_data.full_height;

      var ctx = buffer.getContext('2d');
      ctx.drawImage(img, resized_pano_data.cropped_x, resized_pano_data.cropped_y, resized_pano_data.cropped_width, resized_pano_data.cropped_height);

      var texture = new THREE.Texture(buffer);
      texture.needsUpdate = true;
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;

      // Cache handling.
      if (true === self.config.caching.enabled) {
        var tmpCacheItem = {
          path: targetPano,
          xmpdata: pano_data,
          texture: texture,
          _internals: {
            loader: null,
            progress: 100,
            state: 2
          }
        };
        self._savePanoCache(targetPano, tmpCacheItem);
        self.trigger('pano-preloaded', tmpCacheItem);
      }
      defer.resolve(texture, pano_data);
    };

    var onprogress = function(e) {
      if (e.lengthComputable && self.loader) {
        var new_progress = parseInt(e.loaded / e.total * 100);
        if (new_progress > progress) {
          progress = new_progress;
          self.loader.setProgress(progress);
          self.trigger('panorama-load-progress', targetPano, progress);
        }
      }
    };

    var onerror = function() {
      self.container.textContent = 'Cannot load image';
      throw new PSVError('Cannot load image');
    };

    loader.load(targetPano, onload, onprogress, onerror);
    return defer.promise;
  });
};

/**
 * Applies the texture to the scene
 * Creates the scene if needed
 * @param {THREE.Texture} texture - The sphere texture
 * @returns {promise}
 * @private
 */
PhotoSphereViewer.prototype._setTexture = function(texture) {
  if (!this.scene) {
    this._createScene();
  }

  if (this.mesh.material.map) {
    this.mesh.material.map.dispose();
  }

  this.mesh.material.map = texture;

  this.trigger('panorama-loaded');

  this.render();

  return D.resolved();
};

/**
 * Creates the 3D scene and GUI components
 * @private
 */
PhotoSphereViewer.prototype._createScene = function() {
  this.raycaster = new THREE.Raycaster();

  // Renderer depends on whether WebGL is supported or not
  this.renderer = PhotoSphereViewer.SYSTEM.isWebGLSupported && this.config.webgl ? new THREE.WebGLRenderer() : new THREE.CanvasRenderer();
  this.renderer.setSize(this.prop.size.width, this.prop.size.height);
  this.renderer.setPixelRatio(PhotoSphereViewer.SYSTEM.pixelRatio);

  this.camera = new THREE.PerspectiveCamera(this.config.default_fov, this.prop.size.width / this.prop.size.height, 1, PhotoSphereViewer.SPHERE_RADIUS * 2);
  this.camera.position.set(0, 0, 0);

  if (this.config.gyroscope && PSVUtils.checkTHREE('DeviceOrientationControls')) {
    this.doControls = new THREE.DeviceOrientationControls(this.camera);
  }

  this.scene = new THREE.Scene();
  this.scene.add(this.camera);

  // The middle of the panorama is placed at longitude=0
  var geometry = new THREE.SphereGeometry(PhotoSphereViewer.SPHERE_RADIUS, this.config.sphere_segments, this.config.sphere_segments, -PSVUtils.HalfPI);

  var material = new THREE.MeshBasicMaterial();
  material.side = THREE.DoubleSide;

  this.mesh = new THREE.Mesh(geometry, material);
  this.mesh.scale.x = -1;

  this.scene.add(this.mesh);

  // create canvas container
  this.canvas_container = document.createElement('div');
  this.canvas_container.className = 'psv-canvas-container';
  this.renderer.domElement.className = 'psv-canvas';
  this.container.appendChild(this.canvas_container);
  this.canvas_container.appendChild(this.renderer.domElement);

  // Queue animation
  if (this.config.time_anim !== false) {
    this.prop.start_timeout = window.setTimeout(this.startAutorotate.bind(this), this.config.time_anim);
  }

  // Init shader renderer
  if (this.config.transition && this.config.transition.blur) {
    this.composer = new THREE.EffectComposer(this.renderer);

    this.passes.render = new THREE.RenderPass(this.scene, this.camera);

    this.passes.copy = new THREE.ShaderPass(THREE.CopyShader);
    this.passes.copy.renderToScreen = true;

    this.passes.blur = new THREE.ShaderPass(THREE.GodraysShader);
    this.passes.blur.enabled = false;
    this.passes.blur.renderToScreen = true;

    // values for minimal luminosity change
    this.passes.blur.uniforms.fDensity.value = 0.0;
    this.passes.blur.uniforms.fWeight.value = 0.5;
    this.passes.blur.uniforms.fDecay.value = 0.5;
    this.passes.blur.uniforms.fExposure.value = 1.0;

    this.composer.addPass(this.passes.render);
    this.composer.addPass(this.passes.copy);
    this.composer.addPass(this.passes.blur);
  }
};

/**
 * Perform transition between current and new texture
 * @param {THREE.Texture} texture
 * @param {{latitude: float, longitude: float}} [position]
 * @returns {promise}
 * @private
 */
PhotoSphereViewer.prototype._transition = function(texture, position) {
  var self = this;

  // create a new sphere with the new texture
  var geometry = new THREE.SphereGeometry(150, 32, 32, -PSVUtils.HalfPI);

  var material = new THREE.MeshBasicMaterial();
  material.side = THREE.DoubleSide;
  material.map = texture;
  material.transparent = true;
  material.opacity = 0;

  var mesh = new THREE.Mesh(geometry, material);
  mesh.scale.x = -1;

  // rotate the new sphere to make the target position face the camera
  if (position) {
    // Longitude rotation along the vertical axis
    mesh.rotateY(position.longitude - this.prop.longitude);

    // Latitude rotation along the camera horizontal axis
    var axis = new THREE.Vector3(0, 1, 0).cross(this.camera.getWorldDirection()).normalize();
    var q = new THREE.Quaternion().setFromAxisAngle(axis, position.latitude - this.prop.latitude);
    mesh.quaternion.multiplyQuaternions(q, mesh.quaternion);
  }

  this.scene.add(mesh);
  this.render();

  // animation with blur/zoom ?
  var original_zoom_lvl = this.prop.zoom_lvl;
  var max_zoom_lvl = original_zoom_lvl + 15;
  if (this.config.transition.blur) {
    this.passes.copy.enabled = false;
    this.passes.blur.enabled = true;
  }

  var onTick = function(properties) {
    material.opacity = properties.opacity;

    if (self.config.transition.blur) {
      self.passes.blur.uniforms.fDensity.value = properties.density;
      self.zoom(properties.zoom, false);
    }

    self.render();
  };

  // 1st half animation
  return PSVUtils.animation({
      properties: {
        density: { start: 0.0, end: 1.5 },
        opacity: { start: 0.0, end: 0.5 },
        zoom: { start: original_zoom_lvl, end: max_zoom_lvl }
      },
      duration: self.config.transition.duration / (self.config.transition.blur ? 4 / 3 : 2),
      easing: self.config.transition.blur ? 'outCubic' : 'linear',
      onTick: onTick
    })
    .then(function() {
      // 2nd half animation
      return PSVUtils.animation({
        properties: {
          density: { start: 1.5, end: 0.0 },
          opacity: { start: 0.5, end: 1.0 },
          zoom: { start: 100, end: original_zoom_lvl }
        },
        duration: self.config.transition.duration / (self.config.transition.blur ? 4 : 2),
        easing: self.config.transition.blur ? 'inCubic' : 'linear',
        onTick: onTick
      });
    })
    .then(function() {
      // disable blur shader
      if (self.config.transition.blur) {
        self.passes.copy.enabled = true;
        self.passes.blur.enabled = false;

        self.zoom(original_zoom_lvl, false);
      }

      // remove temp sphere and transfer the texture to the main sphere
      self.mesh.material.map.dispose();
      self.mesh.material.map = texture;

      self.scene.remove(mesh);

      mesh.geometry.dispose();
      mesh.geometry = null;
      mesh.material.dispose();
      mesh.material = null;

      // actually rotate the camera
      if (position) {
        // FIXME: find a better way to handle ranges
        if (self.config.latitude_range || self.config.longitude_range) {
          self.config.longitude_range = self.config.latitude_range = null;
          console.warn('PhotoSphereViewer: trying to perform transition with longitude_range and/or latitude_range, ranges cleared.');
        }

        self.rotate(position);
      }
      else {
        self.render();
      }
    });
};

/**
 * Reverse autorotate direction with smooth transition
 * @private
 */
PhotoSphereViewer.prototype._reverseAutorotate = function() {
  var self = this;
  var newSpeed = -this.config.anim_speed;
  var range = this.config.longitude_range;
  this.config.longitude_range = null;

  PSVUtils.animation({
      properties: {
        speed: { start: this.config.anim_speed, end: 0 }
      },
      duration: 300,
      easing: 'inSine',
      onTick: function(properties) {
        self.config.anim_speed = properties.speed;
      }
    })
    .then(function() {
      return PSVUtils.animation({
        properties: {
          speed: { start: 0, end: newSpeed }
        },
        duration: 300,
        easing: 'outSine',
        onTick: function(properties) {
          self.config.anim_speed = properties.speed;
        }
      });
    })
    .then(function() {
      self.config.longitude_range = range;
      self.config.anim_speed = newSpeed;
    });
};

/**
<<<<<<< HEAD
 * Starts the stereo effect.
 * @private
 * @return {void}
 **/
PhotoSphereViewer.prototype._startStereo = function() {
  /*
  // Need to fix
  if (!this.isFullscreenEnabled()) {
    this.toggleFullscreen();
  }
  */


  this.prop.stereo_effect = new THREE.StereoEffect(this.renderer);
  this.prop.stereo_effect.eyeSeparation = this.config.eyeSeparation;
  this.prop.stereo_effect.setSize(this.prop.size.width, this.prop.size.height);
  this.render();
  //this.startGyroscopeControl();

  /**
   * Indicates that the stereo effect has been toggled.
   * @callback PhotoSphereViewer~onStereoEffectToggled
   * @param {boolean} enabled - `true` if stereo effect is enabled, `false` otherwise
   **/
  this.trigger('stereo-effect-start');
};


/**
 * Stops the stereo effect.
 * @private
 * @return {void}
 **/
PhotoSphereViewer.prototype._stopStereo = function() {
  this.prop.stereo_effect = null;
  this.renderer.setSize(this.prop.size.width, this.prop.size.height);
  this.render();
  this.trigger('stereo-effect-stop');
}

/**
 * Remove a panorama image from the internal cache.
 * @param {String} panorama - The panorama uri, if missing, all the cache will bhe cleared.
 * @private
 * @return {Boolean} False if cache is disabled, true otherwise.
 */
PhotoSphereViewer.prototype._clearTexture = function(panorama) {
  if (true === this.config.caching.enabled) {
    if (panorama) {
      if ('undefined' != typeof this.prop.cache.items[panorama]) {
        delete this.prop.cache.items[panorama];
        this.prop.cache.registry.splice(this.prop.cache.registry.indexOf(panorama), 1);
      }
    }
    else {
      delete this.prop.cache.items;
      this.prop.cache.items = {};
      this.prop.cache.registry = [];
    }
    return true;
  }
  return false;
};

/**
 * Check if the cache size has reached the limit
 * @private
 * @return {Promise}
 */
PhotoSphereViewer.prototype._normalizeCacheSize = function() {
  var defer = D();
  if (true === this.config.caching.enabled) {
    // Unlimited cache?
    if (0 === this.config.caching.maxSize) {
      defer.resolve(true);
    }
    else if (this.prop.cache.registry.length >= this.config.caching.maxSize) {
      // Always remove the older item to make room for the next one.
      defer.resolve(this._clearTexture(this.prop.cache.registry[0]));
    }
    else {
      defer.resolve(true);
    }
  }
  else {
    defer.resolve(false);
  }
  return defer.promise;
};

/**
 * Save a panorama into the internal cache.
 * @param {String} pano - The panorama path
 * @param {Object} item - The panorama cache item.
 * @return {Bool}
 */
PhotoSphereViewer.prototype._savePanoCache = function(pano, item) {
  // If cache item already present..
  if('undefined' !== typeof this.prop.cache.items[pano]){
    this.prop.cache.registry.splice(this.prop.cache.registry.indexOf('pano'), 1);
    this.prop.cache.items[pano] = null;
    delete this.prop.cache.items[pano];
  }
  this.prop.cache.registry.push(pano);
  this.prop.cache.items[pano] = item;
  return true;
};

/**
 * Retrieve a panorama cached item.
 * @param {String} pano - The panorama path
 * @return {Object|null} - The panorama Object, null if not present.
 */
PhotoSphereViewer.prototype._getPanoCache = function(pano) {
  if ('undefined' !== typeof this.prop.cache.items[pano]) {
    return this.prop.cache.items[pano];
  }
  else {
    // May be worth throwing an exception?
    return false;
  }
};

/**
 * Preload a panorama image and store it into the cache.
 * @param {String} pano - The panorama image uri - if not set, use config.panorama
 * @returns {promise}
 * @private
 */
PhotoSphereViewer.prototype._preloadPanorama = function(pano, info) {
  var self = this;
  var pInfo = info || null;

  if(this.isPanoCached(pano) || this.isPanoLoading(pano)){
    return D.resolved(this._getPanoCache(pano));
  }

  var tmpCacheItem = {
    path: pano,
    xmpdata: null,
    texture: null,
    _internals: {
      loader: null,
      progress: 0,
      state: 0 // 0 not loaded, 1 loading, 2 loaded.
    }
  };

  self._savePanoCache(pano, tmpCacheItem);

  return this._loadXMP().then(function(pano_data) {
    var defer = D();
    tmpCacheItem._internals.loader = new THREE.ImageLoader();
    tmpCacheItem._internals.progress = pano_data ? 100 : 0;

    tmpCacheItem._internals.loader.setCrossOrigin('anonymous');

    var onload = function(img) {
      // Config XMP data
      if (!pano_data && self.config.pano_data) {
        pano_data = PSVUtils.clone(self.config.pano_data);
      }

      // Default XMP data
      if (!pano_data) {
        pano_data = {
          full_width: img.width,
          full_height: img.height,
          cropped_width: img.width,
          cropped_height: img.height,
          cropped_x: 0,
          cropped_y: 0
        };
      }

      var r = Math.min(pano_data.full_width, PhotoSphereViewer.SYSTEM.maxTextureWidth) / pano_data.full_width;
      var resized_pano_data = PSVUtils.clone(pano_data);

      resized_pano_data.full_width *= r;
      resized_pano_data.full_height *= r;
      resized_pano_data.cropped_width *= r;
      resized_pano_data.cropped_height *= r;
      resized_pano_data.cropped_x *= r;
      resized_pano_data.cropped_y *= r;

      img.width = resized_pano_data.cropped_width;
      img.height = resized_pano_data.cropped_height;

      // create a new image containing the source image and black for cropped parts
      var buffer = document.createElement('canvas');
      buffer.width = resized_pano_data.full_width;
      buffer.height = resized_pano_data.full_height;

      var ctx = buffer.getContext('2d');
      ctx.drawImage(img, resized_pano_data.cropped_x, resized_pano_data.cropped_y, resized_pano_data.cropped_width, resized_pano_data.cropped_height);

      var texture = new THREE.Texture(buffer);
      texture.needsUpdate = true;
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;

      tmpCacheItem.xmpdata = pano_data;
      tmpCacheItem.texture = texture;
      tmpCacheItem._internals.state = 2;
      // Destroy the loader.
      delete tmpCacheItem._internals.loader;

      self._savePanoCache(pano, tmpCacheItem);
      self.trigger('pano-preloaded', tmpCacheItem, pInfo);

      defer.resolve(tmpCacheItem);
    };

    var onprogress = function(e) {
      if (e.lengthComputable && tmpCacheItem._internals.loader) {
        var new_progress = parseInt(e.loaded / e.total * 100);

        tmpCacheItem._internals.state = 1;
        tmpCacheItem._internals.progress = new_progress;
        self.trigger('panorama-load-progress', pano, new_progress, pInfo);
        self._savePanoCache(pano, tmpCacheItem);
      }
    };

    var onerror = function() {
      defer.reject(false);
      throw new PSVError('Cannot load image');
    };

    tmpCacheItem._internals.loader.load(pano, onload, onprogress, onerror);
    return defer.promise;
  });
};
