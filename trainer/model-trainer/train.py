import os
import matplotlib.pyplot as plt
import matplotlib.image as mpimg
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing import image
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.preprocessing import image
from keras.preprocessing import image

pic_index = 2
# current = '/content/drive/My Drive/datasets'
current = 'assets/'
DATA_PATH = os.path.join(current,'actions')
model_file = os.path.join(current, 'actions.h5')
VALIDATION_DIR = os.path.join(DATA_PATH,"validate")
TRAINING_DIR = os.path.join(DATA_PATH,"train")
WIDTH = HEIGHT = 224

def get_generators():
    training_datagen = ImageDataGenerator(
        rescale = 1./255,
        rotation_range=180,
        width_shift_range=0.2,
        height_shift_range=0.2,
        shear_range=0.2,
        zoom_range=0.2,
        validation_split=0.2,
        horizontal_flip=True,
        fill_mode='nearest')

    validation_datagen = ImageDataGenerator(rescale = 1./255)

    train_generator = training_datagen.flow_from_directory(
        TRAINING_DIR,
        target_size=(WIDTH, HEIGHT),
        class_mode='categorical',
        batch_size=120
    )


    return train_generator #, validation_generator

def train(train_generator, validation_steps):
    model = tf.keras.models.Sequential([
        # Note the input shape is the desired size of the image 224Xs224 with 3 bytes color
        # This is the first convolution
        tf.keras.layers.Conv2D(64, (3,3), activation='relu', input_shape=(WIDTH, HEIGHT, 3)),
        tf.keras.layers.MaxPooling2D(2, 2),
        # The second convolution
        tf.keras.layers.Conv2D(64, (3,3), activation='relu'),
        tf.keras.layers.MaxPooling2D(2,2),
        # The third convolution
        tf.keras.layers.Conv2D(128, (3,3), activation='relu'),
        tf.keras.layers.MaxPooling2D(2,2),
        # The fourth convolution
        tf.keras.layers.Conv2D(128, (3,3), activation='relu'),
        tf.keras.layers.MaxPooling2D(2,2),
        # Flatten the results to feed into a DNN
        tf.keras.layers.Flatten(),
        tf.keras.layers.Dropout(0.5),
        # 512 neuron hidden layer
        tf.keras.layers.Dense(512, activation='relu'),
        tf.keras.layers.Dense(2, activation='softmax')
    ])


    model.summary()

    model.compile(loss = 'categorical_crossentropy', optimizer='rmsprop', metrics=['accuracy'])

    history = model.fit(
        train_generator, 
        epochs=20,
        steps_per_epoch=train_generator.samples / train_generator.batch_size, 
        # validation_data = validation_generator, 
        verbose = 1, 
        validation_steps=validation_steps
    )

    model.save(model_file)
    
    import matplotlib.pyplot as plt
    acc = history.history['accuracy']
    val_acc = history.history['val_accuracy']
    loss = history.history['loss']
    val_loss = history.history['val_loss']

    epochs = range(len(acc))

    plt.plot(epochs, acc, 'r', label='Training accuracy')
    plt.plot(epochs, val_acc, 'b', label='Validation accuracy')
    plt.title('Training and validation accuracy')
    plt.legend(loc=0)
    plt.figure()


    plt.show()
    return model

def build_actions_dictionary():
    actions = {}
    for action_dir in os.listdir(DATA_PATH):
        action_dir_full = os.path.join(DATA_PATH,action_dir)
        files = os.listdir(action_dir_full)
        actions[action_dir] = [os.path.join(action_dir_full, fname) 
                for fname in files]
        
    return actions

actions = build_actions_dictionary()
train_generator = get_generators()
should_train = input("train?Y/N").upper() == 'Y'
if should_train:
    model = train(train_generator, len(actions.keys()))
else:
    model = tf.keras.models.load_model(model_file)

# uploaded = files.upload()

# for fn in uploaded.keys():
 
#   # predicting images
#   path = fn
#   img = image.load_img(path, target_size=(224, 224,3))
#   x = image.img_to_array(img)
#   x = np.expand_dims(x, axis=0)

#   classes = model.predict(x, batch_size=1)
#   print(classes.argmax())
