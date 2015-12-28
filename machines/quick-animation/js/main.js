(function() {

    var loadTemplate = function (id) {
        return _.template($(id).html());
    }

    var renderInto = function(selector, tpl, data) {
        $(selector).innerHTML = tpl(data);
    }

    var PenDelegate = function(el, onPenDown, onPenDraw) {
        this.el = $(el);

        this.onPenDown = onPenDown;
        this.onPenDraw = onPenDraw;

        this.boundMDown = _.bind(this.onMouseDown, this);
        this.boundMMove = _.bind(this.onMouseMove, this);
        this.boundMUp = _.bind(this.onMouseUp, this);

        this.initializeStartEvent();
    }

    PenDelegate.prototype.initializeStartEvent = function() {
        this.el.on('mousedown', this.boundMDown);
    }

    PenDelegate.prototype.onMouseDown = function(e) {
        var coord = Coord.fromMouseEvent(e);
        this.onPenDown(coord);
        this.el.on('mousemove', this.boundMMove)
        this.el.on('mouseup', this.boundMUp)
    }

    PenDelegate.prototype.onMouseMove = function(e) {
        var coord = Coord.fromMouseEvent(e);
        this.onPenDraw(coord);
    }

    PenDelegate.prototype.onMouseUp = function() {
        this.el.off('mousemove', this.boundMMove);
        this.el.off('mouseup', this.boundMUp);
    }

    var Coord = function(x, y) {
        this.x = x;
        this.y = y;
    }

    Coord.fromMouseEvent = function(e) {
        return new Coord(e.offsetX, e.offsetY);
    }

    var Stroke = function() {
        this.coords = [];
    }

    Stroke.prototype.addCoord = function(coord) {
        this.coords.push(coord);
    }

    var Frame = function() {
        this.strokes = [];
    }

    Frame.prototype.addCoord = function(coord) {
        _.last(this.strokes).addCoord(coord);
    }

    Frame.prototype.addStroke = function(stroke) {
        this.strokes.push(stroke);
    }

    var Animation = function() {
        this.frames = [new Frame()];
    }

    Animation.prototype.getFrame = function(index) {
        return (index === undefined) ? _.last(this.frames) : this.frames[index];
    }

    Animation.prototype.addFrame = function(frame) {
        this.frames.push(frame);
        return frame;
    }

    var Cel = function(el) {
        this.el = $(el);
        this.ctx = this.el[0].getContext('2d');
        this.drawingFrame = null;
        this.penDelegate = new PenDelegate(this.el, _.bind(this.onPenDown, this), _.bind(this.onPenDraw, this));
    }

    Cel.prototype.onPenDown = function(coord) {
        this.addStroke();
        this.ctx.beginPath();
        this.ctx.moveTo(coord.x, coord.y);
    }

    Cel.prototype.onPenDraw = function(coord) {
        this.addCoord(coord);
        this.ctx.lineTo(coord.x, coord.y);
        this.ctx.stroke();
    }

    Cel.prototype.setCurrentFrame = function(frame) {
        this.drawingFrame = frame;
    }

    Cel.prototype.addCoord = function(coord) {
        this.drawingFrame.addCoord(coord);
        return coord;
    }

    Cel.prototype.addStroke = function() {
        this.drawingFrame.addStroke(new Stroke);
    }

    Cel.prototype.clear = function() {
        this.ctx.clearRect(0, 0, this.el.width(), this.el.height());
    }

    Cel.prototype.renderFrame = function(frame, style) {
        this.clear();

        this.ctx.save();
        _.extend(this.ctx, style);
        _.each(frame.strokes, this.renderStroke, this);

        this.ctx.restore();
    }

    Cel.prototype.renderStroke = function(stroke) {
        if (stroke.coords <= 1) return;

        this.ctx.beginPath();
        this.ctx.moveTo(stroke.coords[0].x, stroke.coords[0].y);

        for (var i = 1; i < stroke.coords.length; i++) {
            this.ctx.lineTo(stroke.coords[i].x, stroke.coords[i].y);
        }

        this.ctx.stroke();
    }

    var Player = function(animation, cel, options) {
        this.cel = cel;
        this.animation = animation;
        this.options = _.extend({
            loop: true,
            fps: 24,
        }, options);

        this.playing = false;
        this.playHead = 0;
        this.lastTime = 0;
    }

    Player.prototype.loop = function(time) {
        if (!this.playing) return;
        requestAnimationFrame(_.bind(this.loop, this));

        if (!this.shouldDisplayNow(time)) return;
        this.lastTime = time;

        this.loopOrPause();
        this.showFrame(this.playHead++);
    }

    Player.prototype.showFrame = function(frameNum) {
        this.cel.clear();
        this.cel.renderFrame(animation.getFrame(frameNum));
    }

    Player.prototype.shouldDisplayNow = function(time) {
        var timeElapsed = time - this.lastTime;
        return timeElapsed > ((1000/this.options.fps));
    }

    Player.prototype.loopOrPause = function() {
        if (this.playHead >= this.animation.frames.length) {
            if (this.options.loop) {
                this.playHead = 0;
            } else {
                this.pause();
            }
        }
    }

    Player.prototype.play = function() {
        this.playing = true;
        requestAnimationFrame(_.bind(this.loop, this));
    }

    Player.prototype.pause = function() {
        this.playing = false;
    }

    Player.prototype.toggle = function() {
        this.playing = !this.playing;
        if (this.playing) {
            requestAnimationFrame(_.bind(this.loop, this));
        }
    }

    var Controls = function(el, animation, cel, player) {

        this.el = $(el);
        this.animation = animation;
        this.cel = cel;
        this.player = player;

        Object.observe(this.player, _.bind(this.onPlayerChanged, this));

        this.initializeEvents();

        this.templates = {
            controls: loadTemplate('#controls-controls'),
            frameinfo: loadTemplate('#controls-frameinfo')
        };
    }

    Controls.prototype.initializeEvents = function() {
        this.el.on('click', '[data-action-add-frame]', _.bind(this.onClickAddFrame, this));
        this.el.on('click', '[data-action-play]', _.bind(this.onClickPlay, this));
    }

    Controls.prototype.onPlayerChanged = function(changes) {
        _.each(changes, function(change) {
            if (change.name === 'playing') {
                this.renderControls();
            }
        }, this);
    }

    Controls.prototype.onClickAddFrame = function() {
        this.cel.renderFrame(this.animation.getFrame(), {
            globalAlpha: .5,
            strokeStyle: '#ff0000'
        });
        this.cel.setCurrentFrame(this.animation.addFrame(new Frame));
        this.render();
    }

    Controls.prototype.onClickPlay = function() {
        this.player.toggle();
    }

    Controls.prototype.render = function() {
        this.renderControls();
        this.renderFrameInfo();
    }

    Controls.prototype.renderControls = function() {
        var data = { is_playing: this.player.playing };
        $('[data-region="controls"]').html(this.templates.controls(data));
    }

    Controls.prototype.renderFrameInfo = function() {
        var data = { num_frames: animation.frames.length };
        $('[data-region="frameinfo"]').html(this.templates.frameinfo(data));
    }

    var main = function () {

        window.animation = new Animation();
        window.cel = new Cel('#cel');
        window.player = new Player(animation, cel);

        cel.setCurrentFrame(animation.getFrame());

        window.controls = new Controls(
            '#controls',
            animation,
            cel,
            player
        );

        window.controls.render();
    }

    main();

})()
