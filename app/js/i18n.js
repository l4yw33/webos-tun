(function (global) {
  var messages = {
  "Language": "Язык",
  "Disconnect VPN before saving. Only the selected URL is saved; the import list lasts until the app closes. HTTPS subscription URLs are not supported yet.": "Перед сохранением отключите VPN. Сохраняется выбранная ссылка; список для импорта действует до закрытия приложения. HTTPS-ссылки подписки пока не поддерживаются.",
  "ON means processes and a route are present. Internet access is checked separately. Review logs before sharing them.": "ON означает наличие процессов и маршрута. Доступ в интернет проверяется отдельно. Перед публикацией журналов проверьте их содержимое.",
  "Certificate validation is required. Include all server settings, including SNI and the XHTTP path.": "Проверка сертификата обязательна. Для подключения нужны все параметры сервера, включая SNI и путь XHTTP.",
  "Processes and route are active. Check your public IP to confirm internet access.": "Процессы и маршрут активны. Проверьте внешний IP, чтобы подтвердить доступ в интернет.",
  "VPN connects only when you ask. Connect again after restarting the TV.": "VPN включается только по вашей команде. После перезагрузки ТВ подключите его заново.",
  "Paste URLs from your VPN client, one per line. Or load a default.url file.": "Вставьте ссылки из VPN-клиента — по одной на строку. Или загрузите файл default.url.",
  "Runtime update failed; reopen with Homebrew root service available": "Не удалось обновить runtime; откройте приложение с доступным root-сервисом Homebrew",
  "Passwords and UUIDs are hidden in the preview. The input field shows the full URL.": "Пароли и UUID в предпросмотре скрыты. В поле ввода ссылка отображается полностью.",
  "Select a saved profile and connect your TV.": "Выберите сохранённый профиль и подключите телевизор.",
  "Add a server profile and connect your TV.": "Добавьте профиль сервера и подключите телевизор.",
  "The result of your last action will appear here.": "Здесь появится результат последнего действия.",
  "Could not read the helper access token.": "Не удалось получить ключ доступа к помощнику.",
  "Cannot check VPN status; profile not saved": "Не удалось проверить VPN; профиль не сохранён",
  "Local control · No automatic connection": "Локальное управление · Без автоподключения",
  "Manual check. No background requests.": "Проверка вручную. Фоновых запросов нет.",
  "Disconnect VPN before saving a profile": "Отключите VPN перед сохранением профиля",
  "Your connection. Your control.": "Ваше подключение. Под вашим контролем.",
  "Arrows to navigate · OK to select": "Стрелки — выбор · OK — действие",
  "Daemon offline, starting...": "Помощник не запущен, запускаем…",
  "Select or add a profile.": "Выберите или добавьте профиль.",
  "One server. Multiple paths.": "Один сервер. Несколько путей.",
  "Connection details": "Что происходит с подключением",
  "Daemon start failed": "Не удалось запустить помощник",
  "TLS / certificate validation": "TLS / проверка сертификата",
  "Access token unavailable": "Ключ доступа недоступен",
  "IP check failed": "Не удалось проверить IP",
  "Credentials stay on the TV": "Секреты хранятся на ТВ",
  "No profile file found": "Файл профиля не найден",
  "Check public IP": "Проверить внешний IP",
  "Select a profile": "Активировать профиль",
  "Restoring network": "Восстанавливаем сеть",
  "Ready to connect": "Готов к подключению",
  "Profile preview": "Проверка параметров",
  "No background polling": "Без фонового опроса",
  "Helper unavailable": "Помощник недоступен",
  "Check network": "Нужна проверка сети",
  "Connection URLs": "Ссылки подключения",
  "Saving profile": "Сохранение профиля",
  "Reconnecting VPN": "Переподключаем VPN",
  "Save profile": "Сохранить профиль",
  "Action completed": "Команда выполнена",
  "Action failed": "Ошибка выполнения",
  "Save failed": "Ошибка сохранения",
  "Starting helper": "Запуск помощника",
  "Profile saved": "Профиль сохранён",
  "Loading profile": "Загрузка профиля",
  "Profile loaded": "Профиль загружен",
  "Daemon started": "Помощник запущен",
  "Tunnel connected": "Туннель включён",
  "Status refreshed": "Статус обновлён",
  "PRIVATE TUNNEL": "ЛИЧНЫЙ ТУННЕЛЬ",
  "Reconnect": "Переподключить",
  "Load file": "Загрузить файл",
  "Clear screen": "Очистить экран",
  "Helper ready": "Помощник готов",
  "Reading log": "Чтение журнала",
  "Connecting VPN": "Подключаем VPN",
  "Profile selection": "Выбор профиля",
  "Server bypass": "Обход сервера",
  "Checking network": "Проверка сети",
  "Disconnecting VPN": "Отключаем VPN",
  "Restore network": "Вернуть сеть",
  "Connection": "Подключение",
  "Diagnostics": "Диагностика",
  "Not checked": "Не проверен",
  "CONNECTIONS": "ПОДКЛЮЧЕНИЯ",
  "DIAGNOSTICS": "ДИАГНОСТИКА",
  "Working": "Выполняется",
  "Checking IP": "Проверка IP",
  "IP checked": "IP проверен",
  "Connect": "Подключить",
  "Public IP": "Внешний IP",
  "Checking…": "Проверяем…",
  "Controls": "Управление",
  "Application": "Приложение",
  "Refreshing": "Обновление",
  "Disconnect": "Отключить",
  "Checking": "Проверка",
  "Idle": "Ожидание",
  "Refresh": "Обновить",
  "Helper": "Помощник",
  "Sections": "Разделы",
  "Profiles": "Профили",
  "Manual": "Вручную",
  "Route": "Маршрут",
  "Engine": "Движок",
  "Ready": "Готово",
  "Network": "Сеть"
};
  var extra = {"HTTPS subscription":"HTTPS-подписка","Update subscription":"Обновить подписку","Hiddify URL lists or Base64. Manual updates only; select and save a profile to use it.":"Список ссылок Hiddify или Base64. Обновление вручную; выберите и сохраните профиль.","Use an HTTPS subscription URL":"Укажите HTTPS-ссылку подписки","Updating subscription":"Обновление подписки","Subscription update failed":"Не удалось обновить подписку","Subscription loaded. Select and save a profile.":"Подписка загружена. Выберите и сохраните профиль.","Disconnect VPN before saving. Only the selected URL is saved; the import list lasts until the app closes. Subscriptions are loaded with the button above.":"Перед сохранением отключите VPN. Сохраняется выбранный профиль; список действует до закрытия приложения. Подписка загружается кнопкой выше."}; Object.keys(extra).forEach(function (key) { messages[key] = extra[key]; });
  var fileMessages = {"Load subscription file":"Загрузить подписку из файла","Loading subscription file":"Загрузка файла подписки","Subscription URL loaded. Press Update subscription.":"Ссылка загружена. Нажмите «Обновить подписку».","Subscription file is empty or unavailable":"Файл подписки пуст или недоступен"}; Object.keys(fileMessages).forEach(function (key) { messages[key] = fileMessages[key]; });
  var language = 'en';
  try { if (localStorage.getItem('xraytun.language') === 'ru') language = 'ru'; } catch (e) {}
  function translate(text) {
    var key = text;
    if (!Object.prototype.hasOwnProperty.call(messages, key)) {
      Object.keys(messages).some(function (english) { if (messages[english] === text) { key = english; return true; } return false; });
    }
    return language === 'ru' && Object.prototype.hasOwnProperty.call(messages, key) ? messages[key] : key;
  }
  function apply() {
    document.documentElement.lang = language;
    function walk(node) {
      if (node.nodeType === 3) {
        var trimmed = node.nodeValue.trim(), translated = translate(trimmed);
        if (trimmed && translated !== trimmed) node.nodeValue = node.nodeValue.replace(trimmed, translated);
        return;
      }
      if (node.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA|OPTION)$/.test(node.tagName) || node.id === 'logOutput' || node.id === 'profilePreview') return;
      ['aria-label'].forEach(function (attr) { if (node.hasAttribute(attr)) node.setAttribute(attr, translate(node.getAttribute(attr))); });
      for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
    }
    walk(document.body);
    var select = document.getElementById('languageSelect');
    select.value = language;
    select.onchange = function () { language = select.value === 'ru' ? 'ru' : 'en'; try { localStorage.setItem('xraytun.language', language); } catch (e) {} apply(); };
  }
  global.XrayTunI18n = { t: translate, apply: apply };
}(this));
