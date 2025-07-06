// THREEとOrbitControls、OBJLoaderはindex.htmlでグローバルに公開済み
const THREE = window.THREE;
const OrbitControls = window.OrbitControls;
const OBJLoader = window.OBJLoader;

let scene, camera, renderer, controls;
let geospatialLayer, myPointsLayer; // 各レイヤーのTHREE.Group

// 地理院のOBJファイルのパス (★★ここをダウンロードしたOBJファイルパスに置き換えてください★★)
// 例: './data/your_geospatial_model.obj'
//const GEOSPATIAL_OBJ_PATH = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/obj/male02/male02.obj'; // サンプルとしてThree.jsのOBJを使用
const GEOSPATIAL_OBJ_PATH = './data/dem.obj'; // サンプルとしてThree.jsのOBJを使用

const MY_POINTS_GEOJSON_PATH = './data/my_points.geojson';

function init() {
    // シーンの設定
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    // カメラの設定
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 200, 300); // 適切な初期位置に調整

    // レンダラーの設定
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('canvas') });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // 環境光
    const ambientLight = new THREE.AmbientLight(0x404040); // soft white light
    scene.add(ambientLight);

    // ディレクショナルライト（太陽光のような光）
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    // OrbitControls (カメラ操作)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.listenToKeyEvents(window); // キーボードイベントを有効にする (WSADなど)
    controls.enableDamping = true; // 摩擦効果
    controls.dampingFactor = 0.05;

    // レイヤー用のグループを作成
    geospatialLayer = new THREE.Group();
    geospatialLayer.name = 'GeospatialLayer';
    scene.add(geospatialLayer);

    myPointsLayer = new THREE.Group();
    myPointsLayer.name = 'MyPointsLayer';
    scene.add(myPointsLayer);

    // 地理院OBJデータのロード
    loadGeospatialOBJ();

    // 独自GeoJSONデータのロード
    loadMyPointsGeoJSON();

    // UIイベントリスナーの設定
    setupLayerControls();

    // リサイズイベントリスナー
    window.addEventListener('resize', onWindowResize);

    animate();
}

function loadGeospatialOBJ() {
    const objLoader = new OBJLoader();
    objLoader.load(
        GEOSPATIAL_OBJ_PATH,
        (object) => {
            // ロードしたOBJモデルをシーンに追加
            geospatialLayer.add(object);

            // OBJモデルのスケールと位置を調整（★★ここを調整してください★★）
            // 地理院のデータ原点とスケールに合わせて調整が必要です
            // object.scale.set(0.1, 0.1, 0.1); // 例: スケール調整
            // object.position.set(0, 0, 0);   // 例: 位置調整

            // bounding box を計算してカメラ位置を調整するなどのロジックも追加可能
            const bbox = new THREE.Box3().setFromObject(object);
            const center = bbox.getCenter(new THREE.Vector3());
            const size = bbox.getSize(new THREE.Vector3());

            // カメラの位置を調整して全体が見えるようにする（簡易版）
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5; // 少し余裕を持たせる
            
            camera.position.set(center.x, center.y + cameraZ * 0.5, center.z + cameraZ);
            controls.target.copy(center);
            controls.update();

            console.log('地理院OBJデータがロードされました。');
        },
        (xhr) => {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded OBJ');
        },
        (error) => {
            console.error('OBJロードエラー:', error);
            alert('地理院OBJデータのロードに失敗しました。パスを確認してください。');
        }
    );
}

function loadMyPointsGeoJSON() {
    fetch(MY_POINTS_GEOJSON_PATH)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            data.features.forEach(feature => {
                if (feature.geometry.type === 'Point') {
                    const [lon, lat] = feature.geometry.coordinates;
                    const name = feature.properties.name || 'Unnamed Point';

                    // 緯度経度からThree.jsのXYZ座標への簡易的な変換
                    // ★★ここが最も重要で、地理院OBJの原点とスケールに合わせて調整が必要です★★
                    // この例は非常に単純な変換であり、正確な地理座標系変換ライブラリの使用を推奨します
                    // 例えば、proj4.js や、より高度な変換ロジック
                    const radiusOfEarth = 6371000; // 地球の平均半径 (メートル)
                    const metersPerDegreeLon = radiusOfEarth * Math.cos(lat * Math.PI / 180) * Math.PI / 180;
                    const metersPerDegreeLat = radiusOfEarth * Math.PI / 180;

                    // 変換スケールを調整
                    // 地理院OBJモデルのスケールに合わせて、これらの値を調整してください
                    const scaleFactorX = 0.01; // 例: 1メートルをThree.js単位の0.01に変換
                    const scaleFactorY = 0.01; // Z軸に相当
                    const scaleFactorZ = 0.01; // Y軸に相当 (Three.jsはYが上)

                    // 基準点からの相対座標で計算
                    // (lon, lat) の中心座標をモデルの原点(0,0,0)に合わせることで、相対位置を調整
                    const centerLon = 136.8816; // 名古屋駅の経度を基準点とする
                    const centerLat = 35.1709;  // 名古屋駅の緯度を基準点とする

                    const x = (lon - centerLon) * metersPerDegreeLon * scaleFactorX;
                    const z = (lat - centerLat) * metersPerDegreeLat * scaleFactorZ; // Zは奥行き

                    // Pointを示すメッシュを作成
                    const geometry = new THREE.SphereGeometry(2, 32, 32); // 半径2の球
                    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // 赤色
                    const pointMesh = new THREE.Mesh(geometry, material);

                    pointMesh.position.set(x, 10, -z); // Yは高さ。地面から少し浮かせます。Z軸を反転させることも多い。
                    pointMesh.name = `POI: ${name}`;

                    myPointsLayer.add(pointMesh);

                    // ラベル（オプション）
                    // Three.jsで文字を表示するにはTextGeometryなどが必要で、少し複雑になります。
                    // ここでは割愛しますが、CSS3DRendererなども選択肢です。
                }
            });
            console.log('独自POIデータがロードされました。');
        })
        .catch(error => {
            console.error('GeoJSONロードエラー:', error);
            alert('独自GeoJSONデータのロードに失敗しました。パスを確認してください。');
        });
}

function setupLayerControls() {
    const toggleGeospatial = document.getElementById('toggleGeospatial');
    const toggleMyPoints = document.getElementById('toggleMyPoints');

    if (toggleGeospatial) {
        toggleGeospatial.addEventListener('change', (event) => {
            geospatialLayer.visible = event.target.checked;
            animate(); // シーン再描画
        });
    }

    if (toggleMyPoints) {
        toggleMyPoints.addEventListener('change', (event) => {
            myPointsLayer.visible = event.target.checked;
            animate(); // シーン再描画
        });
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    animate(); // シーン再描画
}

function animate() {
    requestAnimationFrame(animate);

    controls.update(); // OrbitControlsの更新
    renderer.render(scene, camera);
}

// 初期化関数の呼び出し
init();