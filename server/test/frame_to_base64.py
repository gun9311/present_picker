import base64

image_path = './test_face_image.jpg' # 실제 이미지 파일 경로로 변경하세요
output_file = 'base64_output.txt' # Base64 문자열을 저장할 파일 이름

try:
    with open(image_path, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')

    with open(output_file, "w") as text_file:
        text_file.write(encoded_string)

    print(f"이미지 '{image_path}'가 Base64로 인코딩되어 '{output_file}'에 저장되었습니다.")
    # print("\nBase64 String (일부):") # 너무 길어서 일부만 출력 (선택 사항)
    # print(encoded_string[:200] + "...")

except FileNotFoundError:
    print(f"오류: 이미지 파일 '{image_path}'를 찾을 수 없습니다.")
except Exception as e:
    print(f"오류 발생: {e}")
