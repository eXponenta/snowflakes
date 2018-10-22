
// HELPER CLASSES 

class CircleParticle extends PIXI.Sprite {

    constructor(texture){
        super(texture);

        this.z_factor = 0;
        this.anchor.set(0.5);
        this._vel = new PIXI.Point();
        this.bounsness = 0.7;
        this.tilt = 0;
        this.startScale = 1;
        this.minScale = this.startScale * 0.25;
    }

    rebildScale(area){
        var dx = area.position.x - this.position.x;
        var dy = area.position.y - this.position.y;
        var rad = dx*dx + dy*dy;

        var s = Math.sqrt(area.radius * area.radius - rad) / area.radius;
        this.scale.set(s * (this.startScale - this.minScale) + this.minScale);
    }

    get radius() {
        var b = this.getBounds();
        return Math.min(b.width, b.height) * 0.5;
    }

    get vel() {
        return this._vel;
    }

    set vel(v) {
        this._vel = v;
    }

    get speed() {
        return Math.sqrt(this._vel.x * this._vel.x + this._vel.y * this._vel.y);
    }

    set speed(ns) {
        
        let s = this.speed;
        
        if(s == 0 || ns == 0 ){
            this._vel.x = 0;
            this._vel.y = 0;
            return;
        }
        
        this._vel.x = this._vel.x * ns / s;
        this._vel.y = this._vel.y * ns / s;
    }

    get dir(){
        let s = this.speed;
        return {
            x: this._vel.x / s,
            y: this._vel.y / s
        }
    }

    set dir(v) {
        let s = this.speed;
        
        this._vel.x = v.x * s;
        this._vel.y = v.y * s;
    }
}

class RectangeArea extends PIXI.Rectangle {
    
    constructor(x, y, w , h ) {
        super(x, y, w, h);
        
    }

    testIntersection(test) {

        let isTested = false;
        let addX = 0;
        let addY = 0;

        // mus be >0 without intersects
        let left_dx = (test.position.x - test.radius) - this.left;
        let right_dx =this.right - (test.position.x + test.radius);
        
        let top_dy = (test.position.y - test.radius) - this.top;
        let btm_dy = this.bottom - (test.position.y + test.radius);

        if(left_dx >= 0 && right_dx >= 0 && top_dy >= 0 && btm_dy >= 0)
            return null;
        
        // if dx >= 0, inner, else outer, get inject
        let dx = 0;
        let dy = 0;

        if(left_dx < 0) dx = -left_dx;
        if(right_dx < 0) dx = right_dx;

        if(top_dy < 0) dy = -top_dy;
        if(btm_dy < 0) dy = btm_dy;
        
        let len = Math.sqrt(dx*dx + dy*dy);
        dx /=len;
        dy /=len;

        return {
            n: { x:  dx, y: dy},
            inject: len
        }
    }
}

class CircleArea extends PIXI.Circle {
    constructor(x, y, r){
        super(x, y, r);
    }

    testIntersection(test) {
        let dx = this.x - test.position.x;
        let dy = this.y - test.position.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
    
        let inject = dist - (this.radius - test.radius); 
        if(inject < 0)
            return undefined;
        
        let result = {
            n: {x: dx / dist, y: dy / dist},
            inject: inject
        }
    
        return result;
    }

}

//HELPER FUNC

function Reflect(v, n) {

    const dn = Math.sqrt(n.x * n.x + n.y * n.y);
    const dv = Math.sqrt(v.x * v.x + v.y * v.y);
    
    const dot = (v.x * n.x + v.y * n.y) / (dn * dv);
    const ref = new PIXI.Point();
    ref.x = v.x - 2 * dot * n.x / dn;
    ref.y = v.y - 2 * dot * n.y / dn;
    
    //console.log("Input:", v, n, "r:", ref);

    return ref;
}


function DumpingVel(factor, vel) {
    let f = factor * vel * vel * Math.sign(vel);
    return vel - factor;
}

// MAIN 

var referenseWidth = 600;
var pAreas = []
var punchForce = 25;

var gravity = 0.008;
var dumpingFactor = 0.005;
var maxSpeed = 10;
var count = 1000;

var container_back = new PIXI.particles.ParticleContainer(count * 0.3, 
    {rotation:true, scale:true});
var container_front = new PIXI.particles.ParticleContainer(count * 0.7, 
    {rotation:true, scale:true});

var container_midlle = new PIXI.Container();

var particles = [];
var angularDrag = 0.01;
let size = null;
let app = null;

function init() {

    let canvas =  document.querySelector(".context");

    let aspect = canvas.clientWidth / canvas.clientHeight;
    app = new PIXI.Application( 
        {
            width: 1000,
            height: 1000 / aspect,
            resolution: window.devicePixelRatio,
            transparent: true,
            view: canvas
        });
    
    size = {
        width: app.renderer.width / app.renderer.resolution,
        height: app.renderer.height / app.renderer.resolution,
    };

    pAreas = [
        new RectangeArea(0,0, size.width, size.height),
        new CircleArea(size.width * 0.5, size.height * 1.3, size.height * 1.3)
    ];

    //parent.appendChild(app.view);
    // Load the bunny texture
    PIXI.loader
        .add('flakes', './src/images/snflakes.json')
        .add('normals',"./src/images/russkoe_disp.png")
        .add('logo', './src/images/logo.png')
        .load(startup);

    var area = new PIXI.Graphics();
    area.lineStyle(2, 0xff0000)
        //.beginFill(0x666666)
        .drawRect(
            pAreas[0].x,
            pAreas[0].y,
            pAreas[0].width,
            pAreas[0].height)
        .drawShape(pAreas[1]);
        //.drawCircle(rndr.width * 0.5, 
        //rndr.height * 0.5, circleArea.radius);
    
    //container.mask = area;
   // app.stage.addChild(area);
    app.stage.addChild(container_back, container_midlle, container_front);

        
}

function punch(e) {

    let duration = e.duration || 500;
    let origin = e.origin || 0;
    let force = e.force || punchForce;
    origin = Math.max(0, Math.min(size.width, origin * size.width));

    var p = particles.sort( 
        (a,b) => {
            let da = Math.abs (a.x - origin);
            let db = Math.abs (b.x - origin);
            return da - db;
        });
    
    var tick = new PIXI.ticker.Ticker();
    var startIndex = 0;

    tick.add( () =>{

        var itemsPerTick = Math.ceil(count * tick.elapsedMS / duration);
        var endIndex = Math.min(p.length, startIndex + itemsPerTick);
        
        for(let i = startIndex; i < endIndex; i++){
            
            p[i].vel.x +=  (0.5 - Math.random()) * punchForce;
            p[i].vel.y += (0.3 - 0.7 * Math.random()) * punchForce;
            p[i].tilt = (0.5 - Math.random()) *0.5; 
        }
        if(endIndex >= p.length)
            tick.stop();
        startIndex = endIndex;
    });
    tick.start();
}

function startup()
{
    app.stage.interactive = true;
    app.stage.buttonMode = true;
    app.stage.hitArea = 
    new PIXI.Rectangle(0, 0, app.renderer.width, app.renderer.height);
    
    var normals = new PIXI.Sprite(PIXI.loader.resources.normals.texture);
    
    //normals.alpha = 0.5;
    normals.anchor.set(0.5, 0);
    normals.position.set(size.width * 0.5, 0);
    
    normals.scale.set(size.width / (normals.width - 100));
    app.stage.addChild(normals);
   
    app.stage.filters = [
        new PIXI.filters.DisplacementFilter(normals, 100, 100)
    ];
    
    let logo = new PIXI.Sprite(PIXI.loader.resources.logo.texture);
    logo.anchor.set(0.5, 1);
    logo.scale.set(size.width / 600);
    logo.position.set(size.width * 0.5, size.height - 50);
    container_midlle.addChild(logo)

    let textures = Object.values(PIXI.loader.resources.flakes.spritesheet.textures);

    for(let i = 0; i < count; i++){
        
        let index = Math.floor(Math.random() * textures.length);

        let flakes = new CircleParticle(textures[index]);
        
        flakes.z_factor = 0.95 + 0.05 * (i % 100) / 100.0;

        //console.log(flakes.z_factor);

        flakes.x = size.width * 0.5 + 
                2 * (0.5 - Math.random()) * pAreas[0].width ;
        flakes.y = size.height  * 0.5 +
                 (0.5 - Math.random()) * pAreas[0].height * 0.8;

        flakes.vel.x = 0.5 - Math.random();
        flakes.vel.y = 0.5 - Math.random();
        flakes.speed = Math.random();
        flakes.tilt = (0.5 - Math.random()) * 0.1; 
        flakes.bounsness = 0.2 + 0.6 * Math.random();

        let scl = 0.8 * (Math.random() * 0.5 + 0.5) * ( size.width / referenseWidth);
        flakes.scale.set(scl);
        //bunny.rebildScale(circleArea);
        //bunny.scale.set(sta;

        if(i < container_back._maxSize)
            container_back.addChild(flakes);
        else
            container_front.addChild(flakes);

        particles.push(flakes);
    }
    // Listen for animate update
    app.ticker.add(function(delta)
    {
        
        for(let i = 0; i <  count; i++){
            let b = particles[i];
            
            b.speed = Math.min(maxSpeed, b.speed);
            b.speed = DumpingVel(dumpingFactor, b.speed);
            

            b.tilt *=(1 - angularDrag * delta) ;
            b.vel.y += gravity  * delta * b.z_factor;
            
            b.position.y += b.vel.y * delta;
            b.position.x += b.vel.x * delta;
            b.rotation += b.tilt * delta;

            //var test = TestCircleIntersectOut(circleArea, b);
            
            for(let testArea of pAreas){
                let test = testArea.testIntersection(b);

                if(test ){

                    b.dir = Reflect(b.dir, test.n);

                    if(Math.abs(b.speed) > gravity * delta * 20)
                        b.speed *= b.bounsness;

                    b.tilt *=  b.bounsness;

                    b.position.y += test.inject * test.n.y;
                    b.position.x += test.inject * test.n.x;
                }
            }
            //b.rebildScale(circleArea);
        }
    });
}




