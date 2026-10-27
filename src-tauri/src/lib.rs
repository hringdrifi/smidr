use serde::Serialize;
#[cfg(windows)]
use std::sync::Mutex;
#[cfg(windows)]
use tauri::Emitter;
use tauri::{AppHandle, Manager, State};
#[cfg(target_os = "windows")]
use window_vibrancy::{apply_acrylic, apply_mica};
#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

#[cfg(windows)]
mod winrt_ble {
    use super::*;
    use anyhow::{anyhow, bail, Result};
    use std::future::IntoFuture;
    use windows::core::{GUID, HSTRING, Ref};
    use windows::Devices::Bluetooth::GenericAttributeProfile::{
        GattCharacteristic, GattCharacteristicProperties,
        GattClientCharacteristicConfigurationDescriptorValue, GattCommunicationStatus,
        GattValueChangedEventArgs, GattWriteOption,
    };
    use windows::Devices::Bluetooth::BluetoothLEDevice;
    use windows::Devices::Enumeration::DeviceInformation;
    use windows::Foundation::TypedEventHandler;
    use windows::Storage::Streams::{DataReader, DataWriter, IBuffer};

    const ZMK_STUDIO_SERVICE: GUID = GUID::from_u128(0x00000000_0196_6107_c967_c5cfb1c2482a);
    const ZMK_STUDIO_CHARACTERISTIC: GUID =
        GUID::from_u128(0x00000001_0196_6107_c967_c5cfb1c2482a);

    #[derive(Clone, Serialize)]
    pub struct ConnectedDevice {
        pub name: String,
        pub id: String,
    }

    pub struct Connection {
        pub _device: BluetoothLEDevice,
        pub characteristic: GattCharacteristic,
        pub value_changed_token: i64,
    }

    impl Connection {
        pub async fn close(&self) {
            if let Ok(op) = self
                .characteristic
                .WriteClientCharacteristicConfigurationDescriptorAsync(
                    GattClientCharacteristicConfigurationDescriptorValue::None,
                ) {
                let _ = op.into_future().await;
            }
            let _ = self
                .characteristic
                .RemoveValueChanged(self.value_changed_token);
        }
    }

    fn frame_payload(payload: &[u8]) -> Vec<u8> {
        let mut result = Vec::with_capacity(payload.len() + 2);
        result.push(0xab);
        for byte in payload {
            if matches!(*byte, 0xab | 0xac | 0xad) {
                result.push(0xac);
            }
            result.push(*byte);
        }
        result.push(0xad);
        result
    }

    fn try_extract_frame(buffer: &mut Vec<u8>) -> Option<Vec<u8>> {
        let sof_idx = buffer.iter().position(|byte| *byte == 0xab)?;
        if sof_idx > 0 {
            buffer.drain(0..sof_idx);
        }

        let mut escaped = false;
        for index in 1..buffer.len() {
            let byte = buffer[index];
            if byte == 0xad && !escaped {
                let mut payload = Vec::new();
                let mut temp_escaped = false;
                for value in &buffer[1..index] {
                    if *value == 0xac && !temp_escaped {
                        temp_escaped = true;
                        continue;
                    }
                    payload.push(*value);
                    temp_escaped = false;
                }
                buffer.drain(0..=index);
                return Some(payload);
            }
            escaped = byte == 0xac && !escaped;
        }

        None
    }

    fn buffer_to_vec(buffer: &IBuffer) -> Result<Vec<u8>> {
        let reader = DataReader::FromBuffer(buffer)?;
        let len = reader.UnconsumedBufferLength()? as usize;
        let mut data = vec![0u8; len];
        reader.ReadBytes(&mut data)?;
        Ok(data)
    }

    fn bytes_to_buffer(data: &[u8]) -> Result<IBuffer> {
        let writer = DataWriter::new()?;
        writer.WriteBytes(data)?;
        Ok(writer.DetachBuffer()?)
    }

    async fn find_devices(name_filter: Option<&str>) -> Result<Vec<DeviceInformation>> {
        let selector = if let Some(name) = name_filter {
            BluetoothLEDevice::GetDeviceSelectorFromDeviceName(&HSTRING::from(name))?
        } else {
            BluetoothLEDevice::GetDeviceSelector()?
        };

        let collection = DeviceInformation::FindAllAsyncAqsFilter(&selector)?
            .into_future()
            .await?;
        let mut devices = Vec::new();
        for index in 0..collection.Size()? {
            devices.push(collection.GetAt(index)?);
        }
        Ok(devices)
    }

    async fn find_studio_device(name_filter: Option<&str>) -> Result<(DeviceInformation, BluetoothLEDevice)> {
        let devices = find_devices(name_filter).await?;
        for info in devices {
            let id = info.Id()?;
            let device = BluetoothLEDevice::FromIdAsync(&id)?.into_future().await?;
            let services_result = device
                .GetGattServicesForUuidAsync(ZMK_STUDIO_SERVICE)?
                .into_future()
                .await?;
            if services_result.Status()? == GattCommunicationStatus::Success
                && services_result.Services()?.Size()? > 0
            {
                return Ok((info, device));
            }
        }
        bail!("No ZMK Studio BLE device found");
    }

    pub async fn list_studio_devices() -> Result<Vec<ConnectedDevice>> {
        let devices = find_devices(None).await?;
        let mut studio_devices = Vec::new();

        for info in devices {
            let id = info.Id()?;
            let device = BluetoothLEDevice::FromIdAsync(&id)?.into_future().await?;
            let services_result = device
                .GetGattServicesForUuidAsync(ZMK_STUDIO_SERVICE)?
                .into_future()
                .await?;
            if services_result.Status()? == GattCommunicationStatus::Success
                && services_result.Services()?.Size()? > 0
            {
                studio_devices.push(ConnectedDevice {
                    name: info.Name()?.to_string(),
                    id: id.to_string(),
                });
            }
        }

        Ok(studio_devices)
    }

    async fn find_studio_device_by_id(device_id: &str) -> Result<(DeviceInformation, BluetoothLEDevice)> {
        let devices = find_devices(None).await?;
        for info in devices {
            let id = info.Id()?;
            if id.to_string() != device_id {
                continue;
            }

            let device = BluetoothLEDevice::FromIdAsync(&id)?.into_future().await?;
            let services_result = device
                .GetGattServicesForUuidAsync(ZMK_STUDIO_SERVICE)?
                .into_future()
                .await?;
            if services_result.Status()? == GattCommunicationStatus::Success
                && services_result.Services()?.Size()? > 0
            {
                return Ok((info, device));
            }
        }

        bail!("Selected ZMK Studio BLE device was not found");
    }

    async fn get_studio_characteristic(device: &BluetoothLEDevice) -> Result<GattCharacteristic> {
        let services_result = device
            .GetGattServicesForUuidAsync(ZMK_STUDIO_SERVICE)?
            .into_future()
            .await?;
        if services_result.Status()? != GattCommunicationStatus::Success {
            bail!(
                "Failed to get ZMK Studio service: {:?}",
                services_result.Status()?
            );
        }
        let services = services_result.Services()?;
        if services.Size()? == 0 {
            bail!("ZMK Studio service not found");
        }

        let chars_result = services
            .GetAt(0)?
            .GetCharacteristicsForUuidAsync(ZMK_STUDIO_CHARACTERISTIC)?
            .into_future()
            .await?;
        if chars_result.Status()? != GattCommunicationStatus::Success {
            bail!(
                "Failed to get ZMK Studio characteristic: {:?}",
                chars_result.Status()?
            );
        }
        let characteristics = chars_result.Characteristics()?;
        if characteristics.Size()? == 0 {
            bail!("ZMK Studio characteristic not found");
        }

        Ok(characteristics.GetAt(0)?)
    }

    pub async fn connect(
        app: AppHandle,
        device_id: Option<String>,
    ) -> Result<(ConnectedDevice, Connection)> {
        let (info, device) = if let Some(device_id) = device_id.as_deref() {
            find_studio_device_by_id(device_id).await?
        } else {
            find_studio_device(None).await?
        };
        let characteristic = get_studio_characteristic(&device).await?;
        let props = characteristic.CharacteristicProperties()?;
        if !props.contains(GattCharacteristicProperties::Write) {
            bail!("ZMK Studio characteristic does not support write-with-response");
        }
        if !props.contains(GattCharacteristicProperties::Indicate)
            && !props.contains(GattCharacteristicProperties::Notify)
        {
            bail!("ZMK Studio characteristic does not support indicate/notify");
        }

        let app_for_handler = app.clone();
        let rx_buffer = std::sync::Arc::new(Mutex::new(Vec::<u8>::new()));
        let rx_buffer_for_handler = rx_buffer.clone();
        let value_handler = TypedEventHandler::new(
            move |_: Ref<GattCharacteristic>, args: Ref<GattValueChangedEventArgs>| {
                if let Ok(args) = args.ok() {
                    match args.CharacteristicValue().and_then(|value| {
                        buffer_to_vec(&value).map_err(|err| {
                            windows::core::Error::new(
                                windows::core::HRESULT(0x80004005u32 as i32),
                                err.to_string(),
                            )
                        })
                    }) {
                        Ok(bytes) => {
                            if let Ok(mut buffer) = rx_buffer_for_handler.lock() {
                                buffer.extend(bytes);
                                while let Some(frame) = try_extract_frame(&mut buffer) {
                                    let _ = app_for_handler.emit("zmk-ble-frame", frame);
                                }
                            }
                        }
                        Err(err) => {
                            eprintln!("Failed to read BLE indication: {err}");
                        }
                    }
                }
                Ok(())
            },
        );
        let value_changed_token = characteristic.ValueChanged(&value_handler)?;

        let cccd = if props.contains(GattCharacteristicProperties::Indicate) {
            GattClientCharacteristicConfigurationDescriptorValue::Indicate
        } else {
            GattClientCharacteristicConfigurationDescriptorValue::Notify
        };
        let cccd_status = characteristic
            .WriteClientCharacteristicConfigurationDescriptorAsync(cccd)?
            .into_future()
            .await?;
        if cccd_status != GattCommunicationStatus::Success {
            bail!("Failed to subscribe to ZMK Studio characteristic: {cccd_status:?}");
        }

        Ok((
            ConnectedDevice {
                name: info.Name()?.to_string(),
                id: info.Id()?.to_string(),
            },
            Connection {
                _device: device,
                characteristic,
                value_changed_token,
            },
        ))
    }

    pub async fn send(characteristic: GattCharacteristic, data: Vec<u8>) -> Result<()> {
        let framed = frame_payload(&data);
        let status = characteristic
            .WriteValueWithOptionAsync(&bytes_to_buffer(&framed)?, GattWriteOption::WriteWithResponse)?
            .into_future()
            .await?;
        if status == GattCommunicationStatus::Success {
            Ok(())
        } else {
            Err(anyhow!("ZMK BLE write failed: {status:?}"))
        }
    }
}

struct NativeBleState {
    #[cfg(windows)]
    connection: Mutex<Option<winrt_ble::Connection>>,
}

impl Default for NativeBleState {
    fn default() -> Self {
        Self {
            #[cfg(windows)]
            connection: Mutex::new(None),
        }
    }
}

#[derive(Serialize)]
struct NativeBleDeviceInfo {
    name: String,
    id: String,
}

#[tauri::command]
fn zmk_ble_connect(
    app: AppHandle,
    state: State<'_, NativeBleState>,
    device_id: Option<String>,
) -> Result<NativeBleDeviceInfo, String> {
    #[cfg(windows)]
    {
        let (device, connection) = tauri::async_runtime::block_on(winrt_ble::connect(app, device_id))
            .map_err(|err| err.to_string())?;
        *state.connection.lock().map_err(|err| err.to_string())? = Some(connection);
        Ok(NativeBleDeviceInfo {
            name: device.name,
            id: device.id,
        })
    }

    #[cfg(not(windows))]
    {
        let _ = (app, state, device_id);
        Err("Native ZMK BLE is currently only implemented on Windows.".to_string())
    }
}

#[tauri::command]
fn zmk_ble_list_devices() -> Result<Vec<NativeBleDeviceInfo>, String> {
    #[cfg(windows)]
    {
        let devices = tauri::async_runtime::block_on(winrt_ble::list_studio_devices())
            .map_err(|err| err.to_string())?;
        Ok(devices
            .into_iter()
            .map(|device| NativeBleDeviceInfo {
                name: device.name,
                id: device.id,
            })
            .collect())
    }

    #[cfg(not(windows))]
    {
        Ok(Vec::new())
    }
}

#[tauri::command]
fn zmk_ble_send(state: State<'_, NativeBleState>, data: Vec<u8>) -> Result<(), String> {
    #[cfg(windows)]
    {
        let characteristic = {
            let guard = state.connection.lock().map_err(|err| err.to_string())?;
            guard
                .as_ref()
                .ok_or_else(|| "ZMK BLE is not connected".to_string())?
                .characteristic
                .clone()
        };
        tauri::async_runtime::block_on(winrt_ble::send(characteristic, data))
            .map_err(|err| err.to_string())
    }

    #[cfg(not(windows))]
    {
        let _ = (state, data);
        Err("Native ZMK BLE is currently only implemented on Windows.".to_string())
    }
}

#[tauri::command]
fn zmk_ble_disconnect(state: State<'_, NativeBleState>) -> Result<(), String> {
    #[cfg(windows)]
    {
        let connection = state.connection.lock().map_err(|err| err.to_string())?.take();
        if let Some(connection) = connection {
            tauri::async_runtime::block_on(connection.close());
        }
        Ok(())
    }

    #[cfg(not(windows))]
    {
        let _ = state;
        Ok(())
    }
}

fn apply_window_material(window: &tauri::WebviewWindow, dark: bool) {
    #[cfg(target_os = "windows")]
    {
        let acrylic_color = if dark {
            (18, 18, 18, 135)
        } else {
            (248, 250, 252, 155)
        };
        if let Err(mica_error) = apply_mica(window, Some(dark)) {
            if let Err(acrylic_error) = apply_acrylic(window, Some(acrylic_color)) {
                eprintln!(
                    "Failed to apply Windows window material: mica={mica_error}; acrylic={acrylic_error}"
                );
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Err(error) = apply_vibrancy(
            window,
            NSVisualEffectMaterial::WindowBackground,
            Some(NSVisualEffectState::Active),
            None,
        ) {
            eprintln!("Failed to apply macOS window vibrancy: {error}");
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = (window, dark);
    }
}

#[tauri::command]
fn set_window_theme(app: AppHandle, dark: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window was not found".to_string())?;
    apply_window_material(&window, dark);
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .manage(NativeBleState::default())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title(&format!("Smidr v{}", env!("CARGO_PKG_VERSION")));
                apply_window_material(&window, true);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_window_theme,
            zmk_ble_list_devices,
            zmk_ble_connect,
            zmk_ble_send,
            zmk_ble_disconnect
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Smidr desktop app");
}
