import sys
import os
import cv2

file_names = sys.argv[1:]
for name in file_names:
    prefix = name.split('.')[0]
    file_path = os.path.join(os.getcwd(), '..','app', 'public', 'video', name)
    vid = cv2.VideoCapture(file_path)
    success,image = vid.read()
    count = 0
    destination = os.path.join(os.getcwd(),'output', prefix)
    print(destination)
    if not os.path.exists(os.path.join(os.getcwd(),'output')):
        os.mkdir(os.path.join(os.getcwd(),'output'))
    if not os.path.exists(destination):
        os.mkdir(destination)
    while success:
        print(count)
        cv2.imwrite(os.path.join(destination,f'frame{count}.jpg'), image)
        success,image = vid.read()
        count += 1