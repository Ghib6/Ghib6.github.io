(() => {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const pad = value => String(value).padStart(2, '0');
  const weatherMap = {
    0: ['晴', '100', '#fdcc45'],
    1: ['少云', '101', '#fe6976'],
    2: ['多云', '102', '#fe7f5b'],
    3: ['阴', '104', '#2152d1'],
    45: ['雾', '501', '#97acba'],
    48: ['雾', '501', '#97acba'],
    51: ['小雨', '305', '#49b1f5'],
    53: ['小雨', '305', '#49b1f5'],
    55: ['中雨', '306', '#49b1f5'],
    61: ['小雨', '305', '#49b1f5'],
    63: ['中雨', '306', '#49b1f5'],
    65: ['大雨', '307', '#49b1f5'],
    71: ['小雪', '400', '#a3c2dc'],
    73: ['中雪', '401', '#a3c2dc'],
    75: ['大雪', '402', '#a3c2dc'],
    80: ['阵雨', '300', '#49b1f5'],
    81: ['阵雨', '300', '#49b1f5'],
    82: ['强阵雨', '301', '#49b1f5'],
    95: ['雷雨', '302', '#fdcc46'],
    96: ['雷雨', '302', '#fdcc46'],
    99: ['雷雨', '302', '#fdcc46']
  };

  const windName = degree => {
    if (typeof degree !== 'number') return '微风';
    const names = ['北风', '东北风', '东风', '东南风', '南风', '西南风', '西风', '西北风'];
    return names[Math.round(degree / 45) % 8];
  };

  const getConfiguredLocation = () => {
    const fallback = '113.34532,23.15624';
    const rectangle = typeof window.clock_rectangle === 'string' && window.clock_rectangle
      ? window.clock_rectangle
      : fallback;
    const [longitude, latitude] = rectangle.split(',').map(Number);
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude }
      : { latitude: 23.15624, longitude: 113.34532 };
  };

  const getVisitorLocation = async () => {
    if (window.clock_default_rectangle_enable === 'true') {
      return { ...getConfiguredLocation(), city: '配置位置' };
    }

    if ('geolocation' in navigator) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            maximumAge: 10 * 60 * 1000,
            timeout: 5000
          });
        });

        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          city: '当前位置'
        };
      } catch (error) {
        // Browser location is optional. Fall through to IP based location.
      }
    }

    try {
      const response = await fetch('https://ipwho.is/?lang=zh-CN');
      if (!response.ok) throw new Error('ip location request failed');
      const data = await response.json();
      if (!data.success || !Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) {
        throw new Error('invalid ip location');
      }

      return {
        latitude: data.latitude,
        longitude: data.longitude,
        city: data.city || data.region || data.country || 'IP位置'
      };
    } catch (error) {
      return { ...getConfiguredLocation(), city: '配置位置' };
    }
  };

  const renderClock = () => {
    const clockBox = document.getElementById('hexo_electric_clock');
    if (!clockBox) return false;

    if (!document.getElementById('card-clock-time')) {
      clockBox.innerHTML = `
        <div class="clock-row">
          <span id="card-clock-clockdate" class="card-clock-clockdate"></span>
          <span class="card-clock-weather"><i class="qi-999-fill" style="color: #97acba"></i> 加载中 <span class="temp">--</span> ℃</span>
          <span class="card-clock-humidity">💧 --%</span>
        </div>
        <div class="clock-row">
          <span id="card-clock-time" class="card-clock-time"></span>
        </div>
        <div class="clock-row">
          <span class="card-clock-windDir"><i class="qi-gale"></i> --</span>
          <span class="card-clock-location">定位中</span>
          <span id="card-clock-dackorlight" class="card-clock-dackorlight"></span>
        </div>
      `;
    }

    const now = new Date();
    const hours = now.getHours();
    const suffix = hours >= 12 ? ' P M' : ' A M';
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${days[now.getDay()]}`;
    const time = `${pad(hours)}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    document.getElementById('card-clock-clockdate').textContent = date;
    document.getElementById('card-clock-time').textContent = time;
    document.getElementById('card-clock-dackorlight').textContent = suffix;
    return true;
  };

  const updateWeather = async () => {
    const weather = document.querySelector('.card-clock-weather');
    const humidity = document.querySelector('.card-clock-humidity');
    const wind = document.querySelector('.card-clock-windDir');
    const location = document.querySelector('.card-clock-location');
    if (!weather || !humidity || !wind || !location) return;

    const { latitude, longitude, city: ipCity } = await getVisitorLocation();
    try {
      const [weatherRes, placeRes] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`),
        fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=zh`)
      ]);

      if (!weatherRes.ok) throw new Error('weather request failed');
      const weatherData = await weatherRes.json();
      const placeData = placeRes.ok ? await placeRes.json() : {};
      const current = weatherData.current || {};
      const [text, icon, color] = weatherMap[current.weather_code] || ['未知', '999', '#97acba'];
      const city = placeData.city || placeData.locality || ipCity || 'IP位置';

      weather.innerHTML = `<i class="qi-${icon}-fill" style="color: ${color}"></i> ${text} <span class="temp">${Math.round(current.temperature_2m)}</span> ℃`;
      humidity.textContent = `💧 ${Math.round(current.relative_humidity_2m)}%`;
      wind.innerHTML = `<i class="qi-gale"></i> ${windName(current.wind_direction_10m)}`;
      location.textContent = city;
    } catch (error) {
      weather.innerHTML = '<i class="qi-999-fill" style="color: #97acba"></i> 天气 <span class="temp">--</span> ℃';
      humidity.textContent = '💧 --%';
      wind.innerHTML = '<i class="qi-gale"></i> --';
      location.textContent = '配置位置';
    }
  };

  const start = () => {
    if (renderClock()) {
      setInterval(renderClock, 1000);
      updateWeather();
      setInterval(updateWeather, 10 * 60 * 1000);
      return;
    }

    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (renderClock() || tries > 40) {
        clearInterval(timer);
        if (document.getElementById('card-clock-time')) {
          setInterval(renderClock, 1000);
          updateWeather();
          setInterval(updateWeather, 10 * 60 * 1000);
        }
      }
    }, 250);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
