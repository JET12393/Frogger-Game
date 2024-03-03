import "./style.css";
import { fromEvent, interval, merge } from 'rxjs';
import { map, filter, scan } from 'rxjs/operators';


//classes , functions and code styles mostly ported from Tim's asteroid code
class Vector2D {
  constructor(public readonly x: number, public readonly y: number) { }
  add = (vec: Vector2D): Vector2D => new Vector2D(this.x + vec.x, this.y + vec.y);
  addX = (unitMove: number) => new Vector2D(this.x + unitMove, this.y);
  moveX = (f: (unitMove: number) => number) => new Vector2D(f(this.x), this.y);
  map = (f: (n: number) => number) => new Vector2D(f(this.x), f(this.y));
}
//to output game over , taken from Tim's code with modification introduced on Ed forum
const attr = (e: Element, o: { [k: string]: unknown }) => { for (const k in o) e.setAttribute(k, String(o[k])) }

class Tick {
  constructor(public readonly time: number) { }
}

class Move {
  constructor(public readonly direction: [number, number]) { }
}

class Reset {
  constructor() { }
}


function main() {
  /**
   * Inside this function you will use the classes and functions from rx.js
   * to add visuals to the svg element in pong.html, animate them, and make them interactive.
   *
   * Study and complete the tasks in observable examples first to get ideas.
   *
   * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
   *
   * You will be marked on your functional programming style
   * as well as the functionality that you implement.
   *
   * Document your code!
   */

  /**
   * This is the view for your game to add and update your game elements.
   */

  /************declaring all the type and interface needed*********/
  //keyboard control 
  type Key = 'KeyA' | 'KeyD' | 'KeyW' | 'KeyS' | 'Space'
  type Event = 'keydown' | 'keyup'
  // viewType for object in game
  type ViewType = 'frog' | 'plank' | 'car' | 'destination' | 'crocodile'
  // the rectangle that doesn't move, base type
  type StaticRect = Readonly<{ id: string, pos: Vector2D, width: number, height: number }>

  interface Rect extends StaticRect {
    velocity: [number, number] //normal movement speed across screen
    added_velocity: number  // the frog movement speed that changes when standing on object such as plank
    viewType: ViewType
  }

  type ObjectBody = Readonly<Rect>
  //for game state
  type State = Readonly<{
    time: number,
    score: number,
    highestScore: number,
    //rectangle objects
    frog: ObjectBody,
    carAllRow: ReadonlyArray<ReadonlyArray<ObjectBody>>,
    plankAllRow: ReadonlyArray<ReadonlyArray<ObjectBody>>,
    destination: ReadonlyArray<ReadonlyArray<ObjectBody>>,
    //array to store destination reached
    destinationReached: ReadonlyArray<ObjectBody>,
    river: Readonly<StaticRect>,
    safeZone: Readonly<StaticRect>,
    gameOver: boolean,
    winRestart:boolean
  }>

  const CONSTANT={
    CANVASSIZE:600,
    FROGMOVEPIXEL:60,
    FIXEDZERO:0,
    FIXEDFIFTY:50,
    FROGX:250,
    FROGY:550
  }

  //game engine : time 
  const gameClock = interval(20).pipe(map(elapsed => new Tick(elapsed)))
  //keyboard movement 
  const keyObservable = <T>(e: Event, k: Key, result: () => T) =>
    fromEvent<KeyboardEvent>(document, e)
      .pipe(
        filter(({ code }) => code === k),
        filter(({ repeat }) => !repeat),
        map(result));


  const moveLeft = keyObservable('keydown', 'KeyA', () => new Move([-CONSTANT.FROGMOVEPIXEL, CONSTANT.FIXEDZERO])),
    moveRight = keyObservable('keydown', 'KeyD', () => new Move([CONSTANT.FROGMOVEPIXEL, CONSTANT.FIXEDZERO])),
    moveUp = keyObservable('keydown', 'KeyW', () => new Move([CONSTANT.FIXEDZERO, -CONSTANT.FROGMOVEPIXEL])),
    moveDown = keyObservable('keydown', 'KeyS', () => new Move([CONSTANT.FIXEDZERO, CONSTANT.FROGMOVEPIXEL])),
    restart = keyObservable('keydown', 'Space', () => new Reset());

  const createFrog = (): ObjectBody =>
    <ObjectBody>{
      velocity: [CONSTANT.FIXEDZERO, CONSTANT.FIXEDZERO],
      added_velocity: CONSTANT.FIXEDZERO,
      viewType: 'frog',
      id: 'frog',
      pos: new Vector2D(CONSTANT.FROGX, CONSTANT.FROGY),
      width: CONSTANT.FIXEDFIFTY,
      height: CONSTANT.FIXEDFIFTY
    }

  const createObject = (viewType: ViewType) => (id: string) => (x: number, y: number) => (width: number) => (height: number) => (velocity: number) => (travelRight: boolean) => (rowId: string) =>
    <ObjectBody>{
      velocity: [travelRight ? velocity : -1 * velocity, CONSTANT.FIXEDZERO], //right positive:left negative
      added_velocity: CONSTANT.FIXEDZERO,   //moving speed
      viewType: viewType,
      id: viewType + id + rowId, //to clearly identify objects in different rows
      pos: new Vector2D(x, y),
      width: width,
      height: height,
    },
    //to create objects in different row
    createRow = (viewType: ViewType) => (x: number, y: number) => (width: number) => (height: number) => (velocity: number) => (travelRight: boolean) => (rowId: string) => (objectCount: number) =>
      [...Array(objectCount)]
        .map((_, i) => createObject(viewType)(String(i))(x + i * CONSTANT.CANVASSIZE / objectCount + width, y)(width)(height)(velocity)(travelRight)(rowId))

  const
    createCar = createRow('car'),
    createPlank = createRow('plank'),
    createDestination = createRow('destination')

  /**initialisation in a hard coded way*/
  const initialState: State =
    {
      time: CONSTANT.FIXEDZERO,
      score: CONSTANT.FIXEDZERO,
      highestScore: CONSTANT.FIXEDZERO,
      frog: createFrog(),
      carAllRow: [
        createCar(CONSTANT.FIXEDZERO, 430)(CONSTANT.FIXEDFIFTY)(CONSTANT.FIXEDFIFTY)(0.5)(true)('row1')(3),
        createCar(100, 370)(CONSTANT.FIXEDFIFTY)(CONSTANT.FIXEDFIFTY)(1)(false)('row2')(4),
        createCar(30, 490)(CONSTANT.FIXEDFIFTY)(CONSTANT.FIXEDFIFTY)(1.5)(true)('row3')(2)
      ],
      plankAllRow: [
        createPlank(38, 70)(150)(CONSTANT.FIXEDFIFTY)(2.5)(false)('row4')(3),
        createPlank(230, 130)(150)(CONSTANT.FIXEDFIFTY)(3)(true)('row5')(2),
        createPlank(200, 190)(150)(CONSTANT.FIXEDFIFTY)(2)(false)('row6')(3),
        createPlank(300, 250)(200)(CONSTANT.FIXEDFIFTY)(2)(true)('row7')(2),
      ],
      destination: [createDestination(CONSTANT.FIXEDZERO, CONSTANT.FIXEDZERO)(80)(CONSTANT.FIXEDFIFTY)(CONSTANT.FIXEDZERO)(true)('row8')(3)],
      destinationReached: [],
      river: {
        id: "river",
        pos: new Vector2D(CONSTANT.FIXEDZERO, 70),
        width: 600,
        height: 230
      },
      gameOver: false,
      winRestart:false,
      safeZone: {
        id: "safeZone",
        pos: new Vector2D(CONSTANT.FIXEDZERO, 300),
        width: 600,
        height: 70
      }
    } as const

  /**movement related functions defined below**/
  const moveBody = (o: ObjectBody) =>
    <ObjectBody>{
      ...o,
      pos: o.viewType === 'frog' ? frogMove(o) : ObjectMove(o),
      velocity: o.viewType === 'frog' ? [CONSTANT.FIXEDZERO, CONSTANT.FIXEDZERO] : o.velocity
    },
    
    frogMove = (o: ObjectBody) => {
      const pixMove = new Vector2D(o.velocity[0] + o.added_velocity, o.velocity[1]);
      //if out of canvas do not move
      return o.pos.add(pixMove).x < CONSTANT.FIXEDZERO || o.pos.add(pixMove).x + 50 > CONSTANT.CANVASSIZE || o.pos.add(pixMove).y < CONSTANT.FIXEDZERO || o.pos.add(pixMove).y > CONSTANT.CANVASSIZE ? o.pos : o.pos.add(pixMove);
    },

    ObjectMove = (o: ObjectBody) => {
      const pixMove = new Vector2D(o.velocity[0], o.velocity[1]);
      const tempPos = o.pos.add(pixMove);
      //object travel left
      return o.velocity[0] < 0 ?
        //go left or back from most right to left 
        (tempPos.moveX((unitMove: number) => unitMove + o.width < 0 ? 600 + o.width : unitMove)) :
        //go right
        (tempPos.moveX((unitMove: number) => unitMove > 600 ? -1 * o.width : unitMove))
    },

    frogRespawn = (o: ObjectBody) => (pos: Vector2D) =>
      <ObjectBody>{
        ...o,
        pos: pos,
        velocity: [0, 0],
        added_velocity: 0
      },
    //frog needs to move with plank
    frogOnPlank = (frog: ObjectBody) => (plank: ObjectBody) =>
      //changes only on frog object, plank not affected
      <ObjectBody>{
        ...frog,
        added_velocity: plank.velocity[0] //frog needs to move with plank when standing on it 
      },
    //reset frog once not on plank
    frogNotOnPlank = (frog: ObjectBody) =>
      <ObjectBody>{
        ...frog,
        velocity: [0, 0],
        added_velocity: 0 //frog no longer on plank so no need to move without keyboard control
      }

  /**collision handling defines below:*/
  const handleCollision = (s: State) => {
    //check for collision between frog and objects  
    const bodiesCollided = (a: ObjectBody, b: ObjectBody): boolean => {
      //checking so as to not getting negative value during reduction
      if (a.pos.x >= b.pos.x) {
        return (a.pos.x - b.pos.x < b.width) && (
          a.pos.y > b.pos.y ? a.pos.y - b.pos.y <= b.height : b.pos.y - a.pos.y <= a.height
        );
      }
      else (a.pos.x < b.pos.x)
      {
        return bodiesCollided(b, a);
      }
    },

      //check if frog is covered by the object, standing fully on plank 
      //
      plankWrapFrog = ([a, b]: [ObjectBody, ObjectBody]): boolean =>
        b.pos.x >= a.pos.x && b.pos.y >= a.pos.y && b.pos.x + b.width <= a.pos.x + a.width && b.pos.y + b.height <= a.pos.y + a.height,
      // check if frog reaches destination, if yes return the destination to add into array for tracking
      destinationCheck = ([a, b]: [ObjectBody, ObjectBody]): ObjectBody | null => {
        return bodiesCollided(a, b) ?
          a.viewType === "destination" ?
            a : b
          : null
      },
      //mark destination that reached
      markDestination = (a: ObjectBody) => (id: string): ObjectBody =>
        <ObjectBody>{
          ...a,
          id: a.id + id
        },
      //check frog collides with car 
      collidedFrogCar = s.carAllRow.map((arr) => arr.filter((arr) => bodiesCollided(arr, s.frog))),
      //check frog reaches destination
      frogDestination = s.destination[0].map((arr) => destinationCheck([arr, s.frog])).filter((arr) => arr),
      //check frog in river
      frogInRiver = (s: State): boolean => s.frog.pos.y >= 60 && s.frog.pos.y <= 300,
      //check frog on a plank, should return an array if it is on a plank
      isFrogOnPlank = s.plankAllRow.map((arr) => arr.filter((arr) => arr.viewType === "plank" && plankWrapFrog([arr, s.frog]))).filter((arr) => arr.length > 0),
      //update destination 
      updateDestination = (destinationCheck: ReadonlyArray<ObjectBody | null>, s: State) =>
        destinationCheck[0] ? s.destinationReached.concat([markDestination(destinationCheck[0])("reached")]) : s.destinationReached,
      //cannot enter destination that's been entered previously 
      checkRepeatedDestination = (destinationCheck: ReadonlyArray<ObjectBody | null>, s: State): boolean =>
        destinationCheck[0] ? s.destinationReached.filter((arr) => arr.id === markDestination(destinationCheck[0] as Rect)("reached").id).length > 0 : false,
      //check frog for collision to determine if it dies 
      isGameOver = (s: State) :boolean=> {
        return collidedFrogCar.map((arr) => arr.length).reduce((x, y) => x + y, 0) > 0      // car, destination, river , plank     
          || checkRepeatedDestination(frogDestination, s) || (frogInRiver(s) && !isFrogOnPlank[0])  
      },
      winGameRestart=(s:State) :boolean=>updateDestination(frogDestination,s).length===3
    return !s.winRestart?{
      ...s,
      score: frogDestination[0] ? s.score + 100 : s.score,
      frog: frogDestination[0] ? frogRespawn(s.frog)(new Vector2D(250, 550)) :
        isFrogOnPlank[0] ? frogOnPlank(s.frog)(isFrogOnPlank[0][0]) : frogNotOnPlank(s.frog),
      //plank and car maintain
      destinationReached: updateDestination(frogDestination, s),
      // gameOver
      gameOver: s.gameOver ? s.gameOver : isGameOver(s),
      winRestart:winGameRestart(s)
    }:
    //else game continue after 3 destinations reached
    {
      ...initialState,
      score:s.score,
      
    }
  }

  // interval tick: manage the movement
  const tick = (s: State, time: number) => {
    return handleCollision({
      ...s,
      time: time,
      frog: moveBody(s.frog),
      carAllRow: s.carAllRow.map((arr) => arr.map(moveBody)),
      plankAllRow: s.plankAllRow.map((arr) => arr.map(moveBody)),
    })
  };

  // state transducer
  const reduceState = (s: State, e: Tick | Move | Reset) =>
    e instanceof Move ? {
      ...s,
      frog: {
        ...s.frog,
        velocity: e.direction
      }
    } // when restart highest score should adjust 
      : e instanceof Reset ? {
        ...initialState,
        highestScore: s.highestScore > s.score ? s.highestScore : s.score
      }
        : tick(s, e.time)

  //******************************* main game stream ********************//
  //******************************* only place with side effect due to subscribe to updateView function which has side effects of updating html diagram */
  const subscription =
    merge(gameClock, moveLeft, moveRight, moveUp, moveDown, restart)
      .pipe(
        scan(reduceState, initialState))
      .subscribe(updateView)

  //the only impure function for the program
  function updateView(s: State) {
    const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement,
      updateBodyView = (flag: Boolean) => (b: ObjectBody) => {      // flag is for destination
        function createBodyView() {
          const v = document.createElementNS(svg.namespaceURI, "rect")!;
          v.classList.add(flag ? 'flag' : b.viewType);
          v.setAttribute("id", b.id);
          v.setAttribute("x", String(b.pos.x));
          v.setAttribute("y", String(b.pos.y));
          v.setAttribute("width", String(b.width));
          v.setAttribute("height", String(b.height));
          svg.appendChild(v)
          return v;
        }
        //if return null then it will run the function to start create rect
        const v = document.getElementById(b.id) || createBodyView();
        v.setAttribute("x", String(b.pos.x));
        v.setAttribute("y", String(b.pos.y));
        //update current score
        const score = document.getElementById("scoreTxt") as HTMLElement;
        score.textContent = String(s.score);
        //update highest score 
        const highestScore = document.getElementById("highestScoreTxt") as HTMLElement;
        highestScore.textContent = String(s.highestScore);
      };

    //creating river 
    if (!document.getElementById(s.river.id)) {
      const river = document.createElementNS(svg.namespaceURI, "rect")!;
      river.setAttribute("x", String(s.river.pos.x));
      river.setAttribute("y", String(s.river.pos.y));
      river.setAttribute("width", String(s.river.width));
      river.setAttribute("height", String(s.river.height));
      river.setAttribute("id", s.river.id);
      river.classList.add("river");
      svg.appendChild(river);
    }
    //creating safezone
    if (!document.getElementById(s.safeZone.id)) {
      const safeZone = document.createElementNS(svg.namespaceURI, "rect")!;
      safeZone.setAttribute("x", String(s.safeZone.pos.x));
      safeZone.setAttribute("y", String(s.safeZone.pos.y));
      safeZone.setAttribute("width", String(s.safeZone.width));
      safeZone.setAttribute("height", String(s.safeZone.height));
      safeZone.setAttribute("id", s.safeZone.id);
      safeZone.classList.add("safeZone");
      svg.appendChild(safeZone);
    }

    //only destination needs to put true as it changes colour
    //screen rendering , frog must be last so it wont be cover by any objects 
    s.carAllRow.forEach((arr) => arr.forEach(updateBodyView(false)));
    s.plankAllRow.forEach((arr) => arr.forEach(updateBodyView(false)));
    s.destination.forEach((arr) => arr.forEach(updateBodyView(false)));
    s.destinationReached.forEach(updateBodyView(true));
    //frog last so that it will not be covered by plank 
    updateBodyView(false)(s.frog);


    if (s.gameOver) {
      // output gameover word on screen and remove everything else
      svg.innerHTML = ``;
      const v = document.createElementNS(svg.namespaceURI, "text")!;
      attr(v, { x: 200, y: 300, class: "gameover" });
      v.textContent = "Game_Over";
      svg.appendChild(v);
    }
    else {
      // Remove the Game Over text from html
      const text = document.getElementsByClassName("gameover");
      [...Array(text.length)].map((_, ind) => text.item(ind)).forEach((item) => item?.remove());
    }
    //reset html element , just for the destination
    if (s.winRestart) {
      svg.innerHTML = ``;
    }

  }


}
setTimeout(main, 0);

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
