import React, { useState, useEffect, useRef } from 'react';

const InventoryApp = () => {
  // 商品データの状態管理
  const [products, setProducts] = useState([]);
  const [currentProduct, setCurrentProduct] = useState({
    janCode: '',
    productName: '',
    quantity: 1,
    expiryDate: '',
    scannedAt: ''
  });
  
  // カメラ・スキャン状態の管理
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [message, setMessage] = useState('「スキャン開始」ボタンでカメラを起動するか、JANコードを手動入力できます');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // JANCodeLookup APIを使った商品情報検索関数
  const [apiKey, setApiKey] = useState(localStorage.getItem('janLookupApiKey') || '');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(!localStorage.getItem('janLookupApiKey'));

  // APIキーを保存
  const saveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('janLookupApiKey', key);
    setIsApiKeyModalOpen(false);
  };

  // 商品名を検索する関数（JANCodeLookup API呼び出し）
  const fetchProductName = async (janCode) => {
    if (!apiKey) {
      return `APIキー未設定 (${janCode})`;
    }
    
    try {
      // APIリクエストURL構築
      const url = `https://api.jancodelookup.com/?appId=${encodeURIComponent(apiKey)}&query=${janCode}&type=code`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API応答エラー: ${response.status}`);
      }
      
      const data = await response.json();
      
      // APIからの応答チェック
      if (data.info && data.info.count > 0 && data.product && data.product.length > 0) {
        const product = data.product[0];
        return product.itemName || `商品名未登録(${janCode})`;
      } else {
        return `商品情報なし(${janCode})`;
      }
    } catch (error) {
      console.error('JANコード検索エラー:', error);
      return `検索エラー(${janCode}): ${error.message}`;
    }
  };

  // カメラ起動処理
  const startCamera = async () => {
    try {
      setCameraError(null);
      const constraints = {
        video: { 
          facingMode: 'environment', // 背面カメラを優先
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setMessage('カメラが起動しました。JANコードをカメラにかざしてください');
        setScanning(true);
      }
    } catch (error) {
      console.error('カメラエラー:', error);
      setCameraError(`カメラの起動に失敗しました: ${error.message}`);
      setMessage('カメラを起動できませんでした。権限を確認するか、別のブラウザをお試しください');
    }
  };

  // カメラ停止処理
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setScanning(false);
      setMessage('カメラを停止しました');
    }
  };

  // バーコードスキャン処理
  const scanBarcode = () => {
    if (!scanning || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    // ビデオが再生可能な状態か確認
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanBarcode);
      return;
    }

    // カメラの映像サイズをキャンバスにセット
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // カメラ映像をキャンバスに描画
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    try {
      // ここでバーコード検出のロジックを入れる
      // 実際の実装ではZXingなどのライブラリを使用することをお勧めします
      // ここでは簡略化のためモックを使います
      
      // TODO: 実際のバーコードスキャン処理

      // スキャン継続
      requestAnimationFrame(scanBarcode);
    } catch (error) {
      console.error('スキャンエラー:', error);
      setMessage(`スキャンエラー: ${error.message}`);
      requestAnimationFrame(scanBarcode);
    }
  };

  // バーコードスキャン開始
  useEffect(() => {
    if (scanning) {
      const intervalId = setInterval(scanBarcode, 500); // 500msごとにスキャン処理
      return () => clearInterval(intervalId);
    }
  }, [scanning]);

  // JANコードの手動検索処理
  const handleManualSearch = async () => {
    if (!currentProduct.janCode) {
      setMessage('JANコードを入力してください');
      return;
    }

    try {
      setMessage(`JAN: ${currentProduct.janCode} を読み取りました。商品名を検索中...`);
      const productName = await fetchProductName(currentProduct.janCode);
      const isDuplicate = products.some(product => product.janCode === currentProduct.janCode);
      
      setCurrentProduct({
        ...currentProduct,
        productName,
        scannedAt: new Date().toISOString()
      });
      
      if (isDuplicate) {
        setMessage(`⚠️ この商品 (${productName}) は既に登録されています`);
      } else {
        setMessage(`商品名: ${productName} が見つかりました。数量を入力してください。`);
      }
    } catch (error) {
      setMessage(`エラー: ${error.message}`);
    }
  };

  // 商品の追加
  const addProduct = () => {
    if (!currentProduct.janCode) {
      setMessage('まず商品をスキャンしてください');
      return;
    }
    
    // 重複チェック
    const duplicateIndex = products.findIndex(p => p.janCode === currentProduct.janCode);
    
    if (duplicateIndex >= 0) {
      // 上書き確認
      if (window.confirm(`「${currentProduct.productName}」は既に登録されています。上書きしますか？`)) {
        const updatedProducts = [...products];
        updatedProducts[duplicateIndex] = currentProduct;
        setProducts(updatedProducts);
        setMessage(`「${currentProduct.productName}」を更新しました`);
      }
    } else {
      // 新規追加
      setProducts([...products, currentProduct]);
      setMessage(`「${currentProduct.productName}」を追加しました`);
    }
    
    // 入力欄をリセット
    setCurrentProduct({
      janCode: '',
      productName: '',
      quantity: 1,
      expiryDate: '',
      scannedAt: ''
    });
  };
  
  // CSVエクスポート
  const exportCSV = () => {
    if (products.length === 0) {
      setMessage('エクスポートするデータがありません');
      return;
    }
    
    // CSVヘッダー
    const headers = ['JANコード', '商品名', '数量', '消費期限', 'スキャン日時'];
    
    // CSVデータの生成
    const csvContent = [
      headers.join(','),
      ...products.map(product => [
        product.janCode,
        `"${product.productName}"`, // カンマを含む場合に対応
        product.quantity,
        product.expiryDate,
        product.scannedAt
      ].join(','))
    ].join('\n');
    
    // BOMを追加して文字化けを防止
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // ダウンロード
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `在庫データ_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setMessage('CSVファイルをエクスポートしました');
  };
  
  // 商品を削除する
  const deleteProduct = (indexToDelete) => {
    if (window.confirm('この商品を削除しますか？')) {
      setProducts(products.filter((_, index) => index !== indexToDelete));
      setMessage('商品を削除しました');
    }
  };
  
  // ローカルストレージからデータを読み込む
  useEffect(() => {
    const savedProducts = localStorage.getItem('inventoryProducts');
    if (savedProducts) {
      setProducts(JSON.parse(savedProducts));
    }
  }, []);
  
  // データが更新されたらローカルストレージに保存
  useEffect(() => {
    localStorage.setItem('inventoryProducts', JSON.stringify(products));
  }, [products]);

  // APIキー設定モーダル
  const ApiKeyModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
        <h3 className="text-lg font-bold mb-4">JANCodeLookup APIキー設定</h3>
        <p className="mb-4 text-sm">
          JANコード検索機能を使用するには、JANCodeLookupのAPIキーが必要です。
          <a href="https://www.jancodelookup.com/" target="_blank" rel="noopener" className="text-blue-500 underline ml-1">
            JANCodeLookup
          </a>
          で取得したAPIキーを入力してください。
        </p>
        <input
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="APIキーを入力"
          className="w-full p-2 border rounded mb-4"
        />
        <div className="flex justify-end">
          <button
            onClick={() => setIsApiKeyModalOpen(false)}
            className="p-2 bg-gray-300 rounded mr-2"
          >
            キャンセル
          </button>
          <button
            onClick={() => saveApiKey(apiKey)}
            className="p-2 bg-blue-500 text-white rounded"
            disabled={!apiKey}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">シンプル在庫管理</h1>
          <button 
            onClick={() => setIsApiKeyModalOpen(true)}
            className="text-sm bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded transition-colors duration-200 shadow-sm"
          >
            APIキー設定
          </button>
        </div>
      </header>
      
      {/* APIキー設定モーダル */}
      {isApiKeyModalOpen && <ApiKeyModal />}
      
      <main className="flex-1 container mx-auto p-4 max-w-3xl">
        {/* メッセージ表示エリア */}
        <div className="bg-white p-4 mb-6 rounded-lg shadow-sm border-l-4 border-blue-500">
          <p className="text-center text-gray-700">{message}</p>
          {cameraError && (
            <p className="text-center text-red-500 text-sm mt-2">
              {cameraError}
            </p>
          )}
        </div>
        
        {/* カメラ操作エリア */}
        <div className="mb-6">
          <button 
            onClick={() => scanning ? stopCamera() : startCamera()}
            className={`w-full p-3 rounded-lg font-bold text-white shadow-sm transition-colors duration-200 ${
              scanning 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {scanning ? 'スキャン停止' : 'スキャン開始'}
          </button>
        </div>
        
        {/* カメラビュー */}
        {scanning && (
          <div className="mb-6 bg-black rounded-lg overflow-hidden shadow-lg relative">
            <video 
              ref={videoRef} 
              className="w-full h-64 object-cover"
              autoPlay 
              playsInline
              onCanPlay={() => setMessage('JANコードをカメラにかざしてください')}
            />
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3/4 h-1/2 border-2 border-white opacity-80 rounded"></div>
            </div>
          </div>
        )}
        
        {/* JANコード手動入力 */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow-sm">
          <h3 className="font-bold mb-3 text-gray-700">JANコード手動入力</h3>
          <div className="flex">
            <input 
              type="text" 
              placeholder="JANコードを入力" 
              className="flex-1 p-2 border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={(e) => setCurrentProduct({...currentProduct, janCode: e.target.value})}
              value={currentProduct.janCode}
              onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
            />
            <button
              onClick={handleManualSearch}
              className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-r transition-colors duration-200"
            >
              検索
            </button>
          </div>
        </div>
        
        {/* 商品情報入力フォーム */}
        {currentProduct.janCode && (
          <div className="bg-white p-5 mb-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="font-bold mb-4 text-gray-800 border-b pb-2">商品情報</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 text-gray-700">JANコード</label>
              <input 
                type="text" 
                value={currentProduct.janCode} 
                readOnly
                className="w-full p-2 border border-gray-300 rounded bg-gray-50 text-gray-600" 
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 text-gray-700">商品名</label>
              <input 
                type="text" 
                value={currentProduct.productName} 
                onChange={(e) => setCurrentProduct({...currentProduct, productName: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 text-gray-700">数量</label>
              <input 
                type="number" 
                min="1"
                value={currentProduct.quantity} 
                onChange={(e) => setCurrentProduct({...currentProduct, quantity: parseInt(e.target.value) || 1})}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>
            
            <div className="mb-5">
              <label className="block text-sm font-medium mb-1 text-gray-700">消費期限 (任意)</label>
              <input 
                type="date" 
                value={currentProduct.expiryDate} 
                onChange={(e) => setCurrentProduct({...currentProduct, expiryDate: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>
            
            <button 
              onClick={addProduct}
              className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors duration-200 shadow-sm"
            >
              保存
            </button>
          </div>
        )}
        
        {/* 商品リスト */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-gray-800">スキャン済み商品 ({products.length})</h2>
            <button 
              onClick={exportCSV}
              className="p-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm shadow-sm transition-colors duration-200"
              disabled={products.length === 0}
            >
              CSVエクスポート
            </button>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm max-h-80 overflow-y-auto">
            {products.length === 0 ? (
              <p className="p-6 text-center text-gray-500">スキャンした商品がここに表示されます</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {products.map((product, index) => (
                  <li key={index} className="p-4 hover:bg-gray-50 transition-colors duration-150">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-medium text-gray-800">{product.productName}</p>
                        <p className="text-sm text-gray-500">JAN: {product.janCode}</p>
                      </div>
                      <div className="flex items-center">
                        <div className="text-right mr-3">
                          <p className="font-bold text-gray-800">{product.quantity}個</p>
                          {product.expiryDate && (
                            <p className="text-xs text-gray-500">
                              消費期限: {product.expiryDate}
                            </p>
                          )}
                        </div>
                        <button 
                          onClick={() => deleteProduct(index)}
                          className="text-red-500 hover:text-red-700 transition-colors duration-200"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
      
      <footer className="bg-gray-800 text-white p-4 text-center text-sm">
        <div className="container mx-auto">
          シンプル在庫管理アプリ © {new Date().getFullYear()} | 
          <a href="https://www.jancodelookup.com/" className="text-blue-300 ml-1 hover:underline" target="_blank" rel="noopener">
            Web Services by JANCODE LOOKUP
          </a>
        </div>
      </footer>
    </div>
  );
};

export default InventoryApp;