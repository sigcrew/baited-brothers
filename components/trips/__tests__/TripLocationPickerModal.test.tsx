import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { TextInput, TouchableOpacity } from 'react-native';
jest.mock('expo-location', () => ({ geocodeAsync: async () => [] }));
jest.mock('@/src/lib/placeSearch', () => ({ searchPlaces: jest.fn(async () => []) }), { virtual: true });
import { searchPlaces } from '@/src/lib/placeSearch';
import { TripLocationPickerModal } from '../TripLocationPickerModal';
import { FishingMap } from '@/components/map/FishingMap';
import { reverseGeocodeKoreanPlaceName } from '@/src/lib/reverseGeocoding';

jest.mock('@/components/map/FishingMap', () => ({ FishingMap: () => null }));
jest.mock('@/src/lib/locationPermission', () => ({ ensureForegroundLocationPermission: async () => true }));
jest.mock('@/src/lib/reverseGeocoding', () => ({ reverseGeocodeKoreanPlaceName: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));

it.each(['충청남도 서천군 앞바다', null])('does not save a failed search query as a manually selected location (%s)', async (name) => {
  (reverseGeocodeKoreanPlaceName as jest.Mock).mockResolvedValue({ name, countryCode: 'KR' });
  const confirm = jest.fn();
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<TripLocationPickerModal visible placeName="대천항" initialPlace={null} onClose={() => {}} onConfirm={confirm} />); });
  const press = async (label: string) => { await act(async () => { await view.root.findAllByType(TouchableOpacity).find(x => x.props.accessibilityLabel === label)!.props.onPress(); }); };
  await press('입력한 낚시터 이름으로 위치 찾기');
  await act(async () => { await view.root.findByType(FishingMap).props.onSelectCoordinate({ latitude: 36.00623, longitude: 126.15530 }); });
  // Editing the search field without selecting a result must not rename the pin.
  await act(async () => { view.root.findByType(TextInput).props.onChangeText('부산항'); });
  await press('선택한 출조 장소 연결');
  expect(confirm).toHaveBeenCalledWith({ name: name || '선택한 낚시터', latitude: 36.00623, longitude: 126.15530 });
  await act(async () => view.unmount());
});

 it('shows candidates without selecting the first and preserves the chosen place name', async () => {
  const place = { id: '1', name: '대천항', address: '충남 보령시 신흑동', latitude: 36.327, longitude: 126.502 };
  (searchPlaces as jest.Mock).mockResolvedValueOnce([place]);
  let view!: ReactTestRenderer;
  const confirm = jest.fn();
  await act(async () => { view = create(<TripLocationPickerModal visible placeName="대천항" initialPlace={null} onClose={() => {}} onConfirm={confirm} />); });
  const button = (label: string) => view.root.findAllByType(TouchableOpacity).find(x => x.props.accessibilityLabel === label);
  await act(async () => { await button('입력한 낚시터 이름으로 위치 찾기')!.props.onPress(); });
  expect(view.root.findByType(FishingMap).props.points).toEqual([]);
  expect(button('대천항, 충남 보령시 신흑동 선택')).toBeDefined();
  await act(async () => { button('대천항, 충남 보령시 신흑동 선택')!.props.onPress(); });
  await act(async () => { button('선택한 출조 장소 연결')!.props.onPress(); });
  expect(confirm).toHaveBeenCalledWith({name: '대천항', latitude: 36.327, longitude: 126.502});
  await act(async () => view.unmount());
 });

it('keeps manual selection available when provider search fails', async () => {
  (searchPlaces as jest.Mock).mockRejectedValueOnce(new Error('quota exhausted'));
  (reverseGeocodeKoreanPlaceName as jest.Mock).mockResolvedValue({name: null, countryCode: 'KR'});
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<TripLocationPickerModal visible placeName="대천항" initialPlace={null} onClose={() => {}} onConfirm={() => {}} />); });
  const search = () => view.root.findAllByType(TouchableOpacity).find(x => x.props.accessibilityLabel === '입력한 낚시터 이름으로 위치 찾기')!;
  await act(async () => { await search().props.onPress(); });
  expect(search().props.disabled).toBe(false);
  await act(async () => { await view.root.findByType(FishingMap).props.onSelectCoordinate({latitude:36.00623,longitude:126.15530}); });
  expect(view.root.findByType(FishingMap).props.points[0].label).toBe('선택한 낚시터');
  await act(async () => view.unmount());
});
