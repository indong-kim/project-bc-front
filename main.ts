import { CharacterData, Direction, GridEngine, Position } from 'grid-engine';
import * as Phaser from 'phaser';
import _ from 'lodash';
import { clientList, me } from './src/env/global-env';

//https://annoraaq.github.io/grid-engine/p/installation/
const sceneConfig: Phaser.Types.Scenes.SettingsConfig = {
  active: false,
  visible: false,
  key: 'Game',
};

export class GameScene extends Phaser.Scene {
  private gridEngine!: GridEngine;
  ws: WebSocket;

  playerSprite;
  constructor() {
    super(sceneConfig);
    this.wsInit();
  }

  private makeSprite() {
    this.playerSprite = this.add.sprite(0, 0, 'player');
    this.playerSprite.scale = 1.5;
    //this.cameras.main.startFollow(playerSprite, true);
    //this.cameras.main.setFollowOffset(-playerSprite.width, -playerSprite.height);
    return this.playerSprite;
  }

  create() {
    const cloudCityTilemap = this.make.tilemap({ key: 'cloud-city-map' });
    cloudCityTilemap.addTilesetImage('Cloud City', 'tiles');
    for (let i = 0; i < cloudCityTilemap.layers.length; i++) {
      const layer = cloudCityTilemap.createLayer(i, 'Cloud City', 0, 0);
      layer.scale = 3;
    }

    console.log('create');
    const gridEngineConfig = {
      characters: [
        {
          id: me['id'],
          sprite: this.makeSprite(),
          walkingAnimationMapping: 6,
          startPosition: me['pos'],
        },
      ],
    };
    this.cameras.main.startFollow(this.playerSprite, true);
    this.cameras.main.setFollowOffset(-this.playerSprite.width, -this.playerSprite.height);

    this.gridEngine.create(cloudCityTilemap, gridEngineConfig);

    const afterCreate = {
      event: 'after-create',
      id: me['id'],
    };
    this.ws.send(JSON.stringify({ event: 'message', data: afterCreate }));

    const cursors = this.input.keyboard.createCursorKeys();
    cursors.left.on('down', (event) => {
      if (!this.isBlock('left')) {
        console.log('move left');
        this.throttledSend('left');
      }
    });
    cursors.right.on('down', (event) => {
      if (!this.isBlock('right')) {
        console.log('move right');
        this.throttledSend('right');
      }
    });
    cursors.up.on('down', (event) => {
      if (!this.isBlock('up')) {
        console.log('move up');
        this.throttledSend('up');
      }
    });
    cursors.down.on('down', (event) => {
      if (!this.isBlock('down')) {
        console.log('move down');
        this.throttledSend('down');
      }
    });
  }

  private isBlock(direction: string): boolean {
    let targetPos = this.gridEngine.getPosition(me['id']);
    switch (direction) {
      case 'left':
        targetPos.x -= 1;
        break;
      case 'right':
        targetPos.y += 1;
        break;
      case 'up':
        targetPos.y -= 1;
        break;
      case 'down':
        targetPos.y += 1;
        break;
    }
    return this.gridEngine.isBlocked(targetPos);
  }

  private throttledSend = _.throttle((direction: string) => {
    const data = {
      event: 'move',
      id: me['id'],
      direction: direction,
    };
    this.ws.send(JSON.stringify({ event: 'message', data }));
  }, 500);

  private wsInit() {
    this.ws = new WebSocket('ws://localhost:3001');
    this.ws.addEventListener('open', (event: Event) => {
      this.ws.send(JSON.stringify({ event: 'open' }));
    });
    this.ws.addEventListener('message', (ev: MessageEvent<any>) => {
      const payload = JSON.parse(ev.data);
      const type = payload['event'];
      switch (type) {
        case 'move':
          /**
                {
                  "event":"move",
                  "result":{
                      "0":{
                        "pos":{
                            "x":3,
                            "y":3
                        }
                      }
                  }
                }
           */
          //payload는 id: pos가 n개 있음
          for (const [id, data] of Object.entries<any>(payload.result)) {
            this.gridEngine.moveTo(id, { x: data['pos']['x'], y: data['pos']['y'] });
          }

          break;
        case 'connection-established':
          console.log('connection-established');
          const id = payload['id'];
          const pos = payload['pos'];
          clientList[id] = {
            id: id,
            pos: pos,
          };
          me['id'] = id; //clientlist에 넣고 hasOwnProperty로 추가 필드 체크하면되는데 귀차늠
          me['pos'] = pos;
          console.log(`my id is ${clientList[id].id}`);
          console.log(`my init pos is ${clientList[id].pos.x} , ${clientList[id].pos.y}`);
          break;
        case 'exist-userlist':
          const clients = payload['clients'];
          for (const [id, pos] of Object.entries<any>(clients)) {
            clientList[id] = {
              id: id,
              pos: pos,
            };
            const characterData: CharacterData = {
              id: id,
              sprite: this.makeSprite(),
              walkingAnimationMapping: 6,
              startPosition: { x: pos.x, y: pos.y },
            };

            this.gridEngine.addCharacter(characterData);
          }
          break;
        case 'new-user':
          console.log('new user connect');
          const newUserId = payload['id'];
          const newUserPos = payload['pos'];

          const characterData: CharacterData = {
            id: newUserId,
            sprite: this.makeSprite(),
            walkingAnimationMapping: 6,
            startPosition: { x: newUserPos.x, y: newUserPos.y },
          };

          //새로 들어온놈만 addcharacter해주면됨
          this.gridEngine.addCharacter(characterData);

          break;
      }
    });
    this.ws.addEventListener('close', (ev: CloseEvent) => {
      console.log('close event');
    });
    this.ws.addEventListener('error', (ev: Event) => {
      console.log('error event');
    });
  }

  public update() {}

  preload() {
    this.load.image('tiles', 'assets/cloud_tileset.png');
    this.load.tilemapTiledJSON('cloud-city-map', 'assets/cloud_city.json');

    this.load.spritesheet('player', 'assets/characters.png', {
      frameWidth: 52,
      frameHeight: 72,
    });
  }
}

const gameConfig: Phaser.Types.Core.GameConfig = {
  title: 'Sample',
  render: {
    antialias: false,
  },
  type: Phaser.AUTO,
  scene: GameScene,
  scale: {
    width: 800,
    height: 600,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  plugins: {
    scene: [
      {
        key: 'gridEngine',
        plugin: GridEngine,
        mapping: 'gridEngine',
      },
    ],
  },
  parent: 'game',
};

export const game = new Phaser.Game(gameConfig);
